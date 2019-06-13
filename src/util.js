import cockpit from 'cockpit';
import varlink from './varlink.js';

const _ = cockpit.gettext;

export const PODMAN_ADDRESS = "unix:/run/podman/io.podman";

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
        return _("");
    }
    return _(id.substr(0, 12));
}

export function format_cpu_percent(cpuPercent) {
    if (cpuPercent === undefined || isNaN(cpuPercent)) {
        return _("");
    }
    return _(cpuPercent.toFixed() + "%");
}

export function format_memory_and_limit(usage, limit) {
    if (usage === undefined || isNaN(usage))
        return _("");

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
        return _("");
    }
}

// TODO: handle different kinds of errors
function handleVarlinkCallError(ex) {
    console.warn("Failed to do varlinkcall:", JSON.stringify(ex));
}

export function updateContainers() {
    return varlink.call(PODMAN_ADDRESS, "io.podman.ListContainers")
            .then(reply => {
                let containers = {};
                let promises = [];

                for (let container of reply.containers || []) {
                    containers[container.id] = container;
                    if (container.status === "running")
                        promises.push(varlink.call(PODMAN_ADDRESS, "io.podman.GetContainerStats", { name: container.id }));
                }

                return Promise.all(promises)
                        .then(replies => {
                            let stats = {};
                            for (let reply of replies)
                                stats[reply.container.id] = reply.container || {};

                            return { newContainers: containers, newContainersStats: stats };
                        });
            })
            .catch(ex => {
                handleVarlinkCallError(ex);
                return Promise.reject(ex);
            });
}

export function updateImages() {
    return varlink.call(PODMAN_ADDRESS, "io.podman.ListImages")
            .then(reply => {
                // Some information about images is only available in the OCI
                // data. Grab what we need and add it to the image itself until
                // podman's API does it for us

                let images = {};
                let promises = [];

                for (let image of reply.images || []) {
                    images[image.id] = image;
                    promises.push(varlink.call(PODMAN_ADDRESS, "io.podman.InspectImage", { name: image.id }));
                }

                return Promise.all(promises)
                        .then(replies => {
                            for (let reply of replies) {
                                let info = JSON.parse(reply.image);
                                let image = images[info.Id];

                                if (info.Config) {
                                    image.entrypoint = info.Config.EntryPoint;
                                    image.command = info.Config.Cmd;
                                    image.ports = Object.keys(info.Config.ExposedPorts || {});
                                }

                                image.author = info.Author;
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
    let ret = [];
    if (cmd === "ONBUILD") {
        for (let i = 0; i < arr.length; i++) {
            let temp = "ONBUILD=" + arr[i];
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
    var words = [ ];
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
