import cockpit from "cockpit";

import { debug } from "./util.js";

function format_error(error, content) {
    let content_o = {};
    if (typeof content === "string") {
        try {
            content_o = JSON.parse(content);
        } catch {
            content_o.message = content;
        }
        return { ...error, ...content_o };
    } else {
        console.warn("format_error(): content is not a string:", content);
        return error;
    }
}

// calls are async, so keep track of a call counter to associate a result with a call
let call_id = 0;

const NL = '\n'.charCodeAt(0); // always 10, but avoid magic constant
const CR = '\r'.charCodeAt(0); // always 13, but avoid magic constant

const PODMAN_SYSTEM_ADDRESS = "/run/podman/podman.sock";

/* uid: null for logged in session user, otherwise standard Unix user ID
 * Return { path, superuser } */
function getAddress(uid) {
    if (uid === null) {
        // FIXME: make this async and call cockpit.user()
        const xrd = sessionStorage.getItem('XDG_RUNTIME_DIR');
        if (xrd)
            return { path: xrd + "/podman/podman.sock", superuser: null };
        console.warn("$XDG_RUNTIME_DIR is not present. Cannot use user service.");
        return { path: "", superuser: null };
    }

    if (uid === 0)
        return { path: PODMAN_SYSTEM_ADDRESS, superuser: "require" };

    if (Number.isInteger(uid))
        return { path: `/run/user/${uid}/podman/podman.sock`, superuser: "require" };

    throw new Error(`getAddress: uid ${uid} not supported`);
}

// split an Uint8Array at \r\n\r\n (separate headers from body)
function splitAtNLNL(array) {
    for (let i = 0; i <= array.length - 4; i++) {
        if (array[i] === CR && array[i + 1] === NL && array[i + 2] === CR && array[i + 3] === NL) {
            return [array.subarray(0, i), array.subarray(i + 4)];
        }
    }
    console.error("did not find NLNL in array", array); // not-covered: if this happens, it's a podman bug
    return [array, null]; // not-covered: ditto
}

/* uid: null for logged in session user; 0 for root; in the future we'll support other users
 * Returns a connection object with methods monitor(), call(), and close(), and an `uid` property.
 */
function connect(uid) {
    const addr = getAddress(uid);
    /* This doesn't create a channel until a request */
    /* HACK: use binary channel to work around https://github.com/cockpit-project/cockpit/issues/19235 */
    const http = cockpit.http(addr.path, { superuser: addr.superuser, binary: true });
    const raw_channels = [];
    const connection = { uid };
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const user_str = (uid === null) ? "user" : (uid === 0) ? "root" : `uid ${uid}`;

    connection.call = function (options) {
        const id = call_id++;
        debug(user_str, `call ${id}:`, JSON.stringify(options));
        return new Promise((resolve, reject) => {
            options = options || {};
            http.request(options)
                    .then(result => {
                        const text = decoder.decode(result);
                        debug(user_str, `call ${id} result:`, text);
                        resolve(text);
                    })
                    .catch((error, content) => {
                        const content_text = decoder.decode(content);
                        debug(user_str, `call ${id} error:`, JSON.stringify(error), "content", content_text);
                        reject(format_error(error, content_text));
                    });
        });
    };

    connection.monitor = function(path, callback, return_raw = false) {
        return new Promise((resolve, reject) => {
            const ch = cockpit.channel({ unix: addr.path, superuser: addr.superuser, payload: "stream", binary: true });
            raw_channels.push(ch);
            let buffer = new Uint8Array();

            ch.addEventListener("close", () => {
                debug(user_str, "monitor", path, "closed");
                resolve();
            });

            const onHTTPMessage = (event, message) => {
                const [headers_bin, body] = splitAtNLNL(message);
                const headers = decoder.decode(headers_bin);
                debug(user_str, "monitor", path, "HTTP response:", headers);
                if (headers.match(/^HTTP\/1.*\s+200\s/)) {
                    // any further message is actual streaming data
                    ch.removeEventListener("message", onHTTPMessage);
                    ch.addEventListener("message", onDataMessage);

                    // process the initial response data
                    if (body)
                        onDataMessage(event, body);
                } else {
                    // empty body Should not Happen™, would be a podman bug
                    const body_text = body ? decoder.decode(body) : "(empty)";
                    reject(format_error({ reason: headers.split('\r\n')[0] }, body_text));
                }
            };

            const onDataMessage = (event, message) => {
                if (return_raw) {
                    // debug(user_str, "monitor", path, "raw data:", message);
                    callback(message);
                } else {
                    buffer = new Uint8Array([...buffer, ...message]);

                    // split the buffer into lines on NL (this is safe with UTF-8)
                    for (;;) {
                        const idx = buffer.indexOf(NL);
                        if (idx < 0)
                            break;

                        const line = buffer.slice(0, idx);
                        buffer = buffer.slice(idx + 1);

                        const line_str = decoder.decode(line);
                        debug(user_str, "monitor", path, "data:", line_str);
                        callback(JSON.parse(line_str));
                    }
                }
            };

            // the initial message is the HTTP status response
            ch.addEventListener("message", onHTTPMessage);

            ch.send(encoder.encode("GET " + path + " HTTP/1.0\r\nContent-Length: 0\r\n\r\n"));
        });
    };

    connection.close = function () {
        http.close();
        raw_channels.forEach(ch => ch.close());
    };

    return connection;
}

export default {
    connect,
    getAddress,
};
