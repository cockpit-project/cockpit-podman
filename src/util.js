import cockpit from 'cockpit';
import varlink from './varlink.js';

const _ = cockpit.gettext;

export const PODMAN_SYSTEM_ADDRESS = "unix:/run/podman/io.podman";

/*
 * Podman returns dates in the format that golang's time.String() exports. Use
 * this format specifier for converting that to moment.js time, e.g.:
 *
 *     moment(date, util.GOLANG_TIME_FORMAT)
 *
 * https://github.com/containers/libpod/issues/2260
 */
export const GOLANG_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss.S Z';

export function truncate_id(id) {
    if (!id) {
        return "";
    }
    return _(id.substr(0, 12));
}

export function format_cpu_percent(cpuPercent) {
    if (cpuPercent === undefined || isNaN(cpuPercent)) {
        return "";
    }
    return cpuPercent.toFixed() + "%";
}

export function format_memory_and_limit(usage, limit) {
    if (usage === undefined || isNaN(usage))
        return "";

    var mtext = "";
    var units = 1024;
    var parts;
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

export function getAddress(system) {
    if (system)
        return PODMAN_SYSTEM_ADDRESS;
    const xrd = sessionStorage.getItem('XDG_RUNTIME_DIR');
    if (xrd)
        return ("unix:" + xrd + "/podman/io.podman");
    console.warn("$XDG_RUNTIME_DIR is not present. Cannot use user service.");
    return "";
}

// TODO: handle different kinds of errors
function handleVarlinkCallError(ex) {
    if (ex.error === "io.podman.ErrRequiresCgroupsV2ForRootless")
        console.log("This OS does not support CgroupsV2. Some information may be missing.");
    else
        console.warn("Failed to do varlinkcall:", JSON.stringify(ex));
}

export function podmanCall(name, args, system) {
    return varlink.call(getAddress(system), "io.podman." + name, args, system);
}

export function monitor(name, args, callback, on_close, system) {
    return varlink.connect(getAddress(system), system)
            .then(connection => connection.monitor("io.podman." + name, args, callback))
            .catch(e => {
                if (e.name === "ConnectionClosed")
                    on_close(system);
                else
                    throw e;
            });
}

export function updateImage(id, system) {
    let image = {};

    return podmanCall("GetImage", { id: id }, system)
            .then(reply => {
                image = reply.image;
                return podmanCall("InspectImage", { name: id }, system);
            })
            .then(reply => Object.assign(image, parseImageInfo(JSON.parse(reply.image))));
}

function parseImageInfo(info) {
    const image = {};

    if (info.Config) {
        image.entrypoint = info.Config.EntryPoint;
        image.command = info.Config.Cmd;
        image.ports = Object.keys(info.Config.ExposedPorts || {});
    }
    image.author = info.Author;

    return image;
}

export function updateImages(system) {
    return podmanCall("ListImages", {}, system)
            .then(reply => {
                // Some information about images is only available in the OCI
                // data. Grab what we need and add it to the image itself until
                // podman's API does it for us

                const images = {};
                const promises = [];

                for (const image of reply.images || []) {
                    images[image.id] = image;
                    promises.push(podmanCall("InspectImage", { name: image.id }, system));
                }

                return Promise.all(promises)
                        .then(replies => {
                            for (const reply of replies) {
                                const info = JSON.parse(reply.image);
                                // Update image with information from InspectImage API
                                images[info.Id] = Object.assign(images[info.Id], parseImageInfo(info));
                                images[info.Id].isSystem = system;
                            }
                            return images;
                        });
            })
            .catch(ex => {
                handleVarlinkCallError(ex);
                return Promise.reject(ex);
            });
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
 *
 * This comes from cockpit-project/cockpit docker package. Changes should be
 * made there and then backported here.
 */

export function quote_cmdline(words) {
    words = words || [];

    function is_whitespace(c) {
        return c == ' ';
    }

    function quote(word) {
        var text = "";
        var quote_char = "";
        var i;
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
    var words = [];
    var next;

    function is_whitespace(c) {
        return c == ' ';
    }

    function skip_whitespace() {
        while (next < text.length && is_whitespace(text[next]))
            next++;
    }

    function parse_word() {
        var word = "";
        var quote_char = null;

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

export function isRootUser() {
    return window.cockpit.user().then((user) => {
        return user.name === 'root';
    });
};
