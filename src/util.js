import cockpit from 'cockpit';

const moment = require('moment');
const _ = cockpit.gettext;

// https://github.com/containers/podman/blob/master/libpod/define/containerstate.go
export const states = [_("configured"), _("created"), _("running"), _("stopped"), _("paused"), _("exited"), _("removing")];

// https://github.com/containers/podman/blob/master/libpod/define/podstate.go
export const podStates = [_("Created"), _("Running"), _("Stopped"), _("Paused"), _("Exited"), _("Error")];

export function truncate_id(id) {
    if (!id) {
        return "";
    }
    return id.substr(0, 12);
}

// On some places time is passed as timestamp and on some as string
export function localize_time(time) {
    if (Number.isInteger(time))
        return moment(time * 1000).calendar();
    return moment(time, "YYYY-MM-DDTHH:mm:ss.SZ").calendar();
}

export function format_memory_and_limit(usage, limit) {
    if (usage === undefined || isNaN(usage))
        return "";

    usage = usage / 1073741824; // 1024^3
    limit = limit / 1073741824;
    let mtext = "";
    let units = 1024;
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

export function getCommitArr(arr, cmd) {
    const ret = [];
    if (cmd === "ONBUILD") {
        for (let i = 0; i < arr.length; i++) {
            const temp = "ONBUILD=" + arr[i];
            ret.push(temp);
        }
    }
    return ret;
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

/*
 * Return 1 if first argument is newer version, 0 if they are equal and -1 otherwise.
 * Both arguments are required to be strings, in form `\d(\.\d)*`.
 * Taken from cockpit `pkg/storaged/utils.js`.
 */
export function compare_versions(a, b) {
    function to_ints(str) {
        return str.split(".").map(function (s) { return s ? parseInt(s, 10) : 0 });
    }

    var a_ints = to_ints(a);
    var b_ints = to_ints(b);
    var len = Math.min(a_ints.length, b_ints.length);
    var i;

    for (i = 0; i < len; i++) {
        if (a_ints[i] == b_ints[i])
            continue;
        return a_ints[i] - b_ints[i];
    }

    return a_ints.length - b_ints.length;
}

/*
 * Gets a dictionary of remote hosts with hosts as keys and addresses as values.
 */
export function getRemoteHosts() {
    const result = {};

    // The Cockpit host may be the SSH address, while the connected host in v2-machines.json is never that
    const currentAddress = cockpit.transport.host;
    const currentHost = currentAddress.includes("@") ? currentAddress.split("@")[1] : currentAddress;

    const hosts = JSON.parse(cockpit.sessionStorage.getItem("v2-machines.json"));

    // Get connected (i.e. usable) hosts from the overlay
    for (const host in hosts.overlay) {
        if (Object.hasOwnProperty.call(hosts.overlay, [host]) && hosts.overlay[host].state === "connected" &&
            host !== currentHost) {
            result[host] = host;
        }
    }

    // Look for SSH addresses in the overlay
    for (const address in hosts.overlay) {
        if (!address.includes("@"))
            continue;

        const host = address.split("@")[1];
        if (result[host] === undefined)
            continue;

        // Replace host with address
        result[host] = address;
    }

    return result;
}
