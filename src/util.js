import React, { useContext } from "react";

import cockpit from 'cockpit';

import { debounce } from 'throttle-debounce';
import * as dfnlocales from 'date-fns/locale';
import { formatRelative } from 'date-fns';
const _ = cockpit.gettext;

export const PodmanInfoContext = React.createContext();
export const usePodmanInfo = () => useContext(PodmanInfoContext);

export const WithPodmanInfo = ({ value, children }) => {
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

export function debug(system, ...args) {
    if (window.debugging === "all" || window.debugging?.includes("podman"))
        console.debug("podman", system ? "system" : "user", ...args);
}

export function truncate_id(id) {
    if (!id) {
        return "";
    }
    return id.substr(0, 12);
}

export function localize_time(unix_timestamp) {
    const locale = (cockpit.language == "en") ? dfnlocales.enUS : dfnlocales[cockpit.language.replace('_', '')];
    return formatRelative(unix_timestamp * 1000, Date.now(), { locale });
}

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

export function quote_cmdline(words) {
    words = words || [];

    function is_whitespace(c) {
        return c == ' ';
    }

    function quote(word) {
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

export function unquote_cmdline(text) {
    const words = [];
    let next;

    function is_whitespace(c) {
        return c == ' ';
    }

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

    next = 0;
    skip_whitespace();
    while (next < text.length) {
        words.push(parse_word());
        skip_whitespace();
    }

    return words;
}

export function image_name(image) {
    return image.RepoTags ? image.RepoTags[0] : "<none>:<none>";
}

export function is_valid_container_name(name) {
    return /^[a-zA-Z0-9][a-zA-Z0-9_\\.-]*$/.test(name);
}

/* Clears a single field in validationFailed object.
 *
 * Arguments:
 *   - validationFailed (object): Object containing list of fields with validation error
 *   - key (string): Specified which field from validationFailed object is clear
 *   - onValidationChange (func)
 */
export const validationClear = (validationFailed, key, onValidationChange) => {
    if (!validationFailed)
        return;

    const delta = { ...validationFailed };
    delete delta[key];
    onValidationChange(delta);
};

// This method needs to be outside of component as re-render would create a new instance of debounce
export const validationDebounce = debounce(500, (validationHandler) => validationHandler());
