import cockpit from 'cockpit';

import * as dfnlocales from 'date-fns/locale';
import { formatRelative } from 'date-fns';
const _ = cockpit.gettext;

// https://github.com/containers/podman/blob/main/libpod/define/containerstate.go
// "Restarting" comes from special handling of restart case in Application.updateContainerAfterEvent()
export const states = [_("Configured"), _("Created"), _("Running"), _("Stopped"), _("Paused"), _("Exited"), _("Removing"), _("Restarting")];

// https://github.com/containers/podman/blob/main/libpod/define/podstate.go
export const podStates = [_("Created"), _("Running"), _("Stopped"), _("Paused"), _("Exited"), _("Error")];

export const fallbackRegistries = ["docker.io", "quay.io"];

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

export function format_memory_and_limit(usage, limit) {
    if (usage === undefined || isNaN(usage))
        return "";

    let mtext = "";
    let units = 1000;
    let parts;
    if (limit) {
        parts = cockpit.format_bytes(limit, units, true);
        mtext = " / " + parts.join(" ");
        units = parts[1];
    }

    if (usage) {
        parts = cockpit.format_bytes(usage, units, true);
        if (mtext)
            return _(parts[0] + mtext);
        else
            return _(parts.join(" "));
    } else {
        return "";
    }
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
