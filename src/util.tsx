/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React, { useContext } from "react";

import { Tooltip } from "@patternfly/react-core/dist/esm/components/Tooltip";
import { debounce } from 'throttle-debounce';

import cockpit from 'cockpit';
import * as timeformat from 'timeformat';

const _ = cockpit.gettext;

// not documented in https://docs.podman.io/en/stable/_static/api.html#tag/system/operation/SystemInfoLibpod
// only the fields that we actually use
type Registries = {
    search?: string[],
}

type PodmanInfoContextType = {
    cgroupVersion: string,
    registries: Registries,
    selinuxAvailable: boolean,
    userPodmanRestartAvailable: boolean,
    userLingeringEnabled: boolean,
    version: string,
}

export const PodmanInfoContext = React.createContext<PodmanInfoContextType | null>(null);

export const usePodmanInfo = () => useContext(PodmanInfoContext);

export const WithPodmanInfo = ({ value, children }: { value: PodmanInfoContextType, children: React.ReactNode }) => {
    return (
        <PodmanInfoContext.Provider value={value}>
            {children}
        </PodmanInfoContext.Provider>
    );
};

// https://github.com/containers/podman/blob/main/libpod/define/containerstate.go
// "Restarting" comes from special handling of restart case in Application.updateContainer()
export const states = [_("Exited"), _("Paused"), _("Stopped"), _("Removing"), _("Configured"), _("Created"), _("Restart"), _("Running")];

// https://github.com/containers/podman/blob/main/libpod/define/podstate.go
export const podStates = [_("Created"), _("Running"), _("Stopped"), _("Paused"), _("Exited"), _("Error")];

export const fallbackRegistries = ["docker.io", "quay.io"];

export function debug(...args: unknown[]): void {
    if (window.debugging === "all" || window.debugging?.includes("podman"))
        console.debug("podman", ...args);
}

// containers, pods, images states are indexed by these keys, to make the container IDs
// globally unique across users
export const makeKey = (uid: number | null, id: string) => `${uid ?? "user"}-${id}`;

export function truncate_id(id: string): string {
    if (!id) {
        return "";
    }
    return id.substring(0, 12);
}

// this supports formatted strings (via Date.parse) or raw timestamps
export const RelativeTime = ({ time }: { time: Date | string }) => {
    if (!time)
        return null;
    const timestamp = typeof time === "string" ? Date.parse(time) : time;
    const dateRel = timeformat.distanceToNow(timestamp);
    const dateAbs = timeformat.dateTimeSeconds(timestamp);
    return <Tooltip content={dateAbs}><span>{dateRel}</span></Tooltip>;
};

const is_whitespace = (c: string) => c === ' ';

/*
 * The functions quote_cmdline and unquote_cmdline implement
 * a simple shell-like quoting syntax.  They are used when letting the
 * user edit a sequence of words as a single string.
 *
 * When parsing, words are separated by whitespace.  Single and double
 * quotes can be used to protect a sequence of characters that
 * contains whitespace or the other quote character.  A backslash can
 * be used to protect any character.  Quotes can appear in the middle
 * of a word.
 */

export function quote_cmdline(words: string[] | undefined): string {
    words = words || [];

    function quote(word: string): string {
        let text = "";
        let quote_char = "";
        let i;
        for (i = 0; i < word.length; i++) {
            if (word[i] == '\\' || word[i] == quote_char)
                text += '\\';
            else if (quote_char === "") {
                if (word[i] == "'" || is_whitespace(word[i]))
                    quote_char = '"';
                else if (word[i] == '"')
                    quote_char = "'";
            }
            text += word[i];
        }

        return quote_char + text + quote_char;
    }

    return words.map(quote).join(' ');
}

export function unquote_cmdline(text: string): string[] {
    const words = [];
    let next = 0;

    function skip_whitespace() {
        while (next < text.length && is_whitespace(text[next]))
            next++;
    }

    function parse_word() {
        let word = "";
        let quote_char = null;

        while (next < text.length) {
            if (text[next] == '\\') {
                next++;
                if (next < text.length) {
                    word += text[next];
                }
            } else if (text[next] == quote_char) {
                quote_char = null;
            } else if (quote_char) {
                word += text[next];
            } else if (text[next] == '"' || text[next] == "'") {
                quote_char = text[next];
            } else if (is_whitespace(text[next])) {
                break;
            } else
                word += text[next];
            next++;
        }
        return word;
    }

    skip_whitespace();
    while (next < text.length) {
        words.push(parse_word());
        skip_whitespace();
    }

    return words;
}

// FIXME: Create a proper Image type, and either move types out into a separate file, or move this function
export function image_name(image: { RepoTags?: string[] }): string {
    return image.RepoTags?.[0] ?? "<none>:<none>";
}

export function is_valid_container_name(name: string): boolean {
    return /^[a-zA-Z0-9][a-zA-Z0-9_\\.-]*$/.test(name);
}

type ValidationState = Record<string, unknown>;
type ValidationHandler = (state: ValidationState) => void;

/* Clears a single field in validationFailed object.
 *
 * Arguments:
 *   - validationFailed (object): Object containing list of fields with validation error
 *   - key (string): Specified which field from validationFailed object is clear
 *   - onValidationChange (func)
 */
export const validationClear = (validationFailed: ValidationState | undefined, key: string, onValidationChange: ValidationHandler) => {
    if (!validationFailed)
        return;

    const delta = { ...validationFailed };
    delete delta[key];
    onValidationChange(delta);
};

// This method needs to be outside of component as re-render would create a new instance of debounce
export const validationDebounce = debounce(500, (validationHandler) => validationHandler());

// Ignore podman-compose containers which like quadlets set PODMAN_SYSTEMD_UNIT.
// https://github.com/containers/podman-compose/blob/0dcc864fdda280b410ad49ae4fa99740a4770cbb/podman_compose.py#L2263
// FIXME: yes yes, the container config type should be fully spelled out
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const is_systemd_service = (container_config: { [key: string]: any }) => container_config?.Labels?.PODMAN_SYSTEMD_UNIT && !container_config.Labels.PODMAN_SYSTEMD_UNIT.startsWith('podman-compose@');

export const systemctl_spawn = (args: string[], system: boolean = false) => {
    const systemctl_args = [
        "systemctl",
        ...(system ? [] : ["--user"]),
    ];

    return cockpit.spawn([...systemctl_args, ...args], { superuser: system ? "require" : null, err: "message" });
};
