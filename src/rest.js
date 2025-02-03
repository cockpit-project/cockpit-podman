import cockpit from "cockpit";

import { debug } from "./util.js";

function manage_error(reject, error, content) {
    let content_o = {};
    if (content) {
        try {
            content_o = JSON.parse(content);
        } catch {
            content_o.message = content;
        }
    }
    const c = { ...error, ...content_o };
    reject(c);
}

// calls are async, so keep track of a call counter to associate a result with a call
let call_id = 0;

const NL = '\n'.charCodeAt(0); // always 10, but avoid magic constant

const PODMAN_SYSTEM_ADDRESS = "/run/podman/podman.sock";

/* uid: null for logged in session user; 0 for root; in the future we'll support other users */
/* Return { path, superuser } */
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

    throw new Error(`getAddress: uid ${uid} not supported`);
}

/* uid: null for logged in session user; 0 for root; in the future we'll support other users */
function connect(uid) {
    const addr = getAddress(uid);
    /* This doesn't create a channel until a request */
    /* HACK: use binary channel to work around https://github.com/cockpit-project/cockpit/issues/19235 */
    const http = cockpit.http(addr.path, { superuser: addr.superuser, binary: true });
    const connection = {};
    const decoder = new TextDecoder();
    const user_str = (uid === null) ? "user" : (uid === 0) ? "root" : `uid ${uid}`;

    connection.monitor = function(options, callback, return_raw) {
        return new Promise((resolve, reject) => {
            let buffer = new Uint8Array();

            http.request(options)
                    .stream(data => {
                        if (return_raw)
                            callback(data);
                        else {
                            buffer = new Uint8Array([...buffer, ...data]);

                            // split the buffer into lines on NL (this is safe with UTF-8)
                            for (;;) {
                                const idx = buffer.indexOf(NL);
                                if (idx < 0)
                                    break;

                                const line = buffer.slice(0, idx);
                                buffer = buffer.slice(idx + 1);

                                const line_str = decoder.decode(line);
                                debug(user_str, "monitor", line_str);
                                callback(JSON.parse(line_str));
                            }
                        }
                    })
                    .catch((error, content) => {
                        manage_error(reject, error, content);
                    })
                    .then(resolve);
        });
    };

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
                        const text = decoder.decode(content);
                        debug(user_str, `call ${id} error:`, JSON.stringify(error), "content", text);
                        manage_error(reject, error, text);
                    });
        });
    };

    connection.close = function () {
        http.close();
    };

    return connection;
}

/*
 * Connects to the podman service, performs a single call, and closes the
 * connection.
 */
async function call (uid, parameters) {
    const connection = connect(uid);
    const result = await connection.call(parameters);
    connection.close();
    return result;
}

export default {
    connect,
    call,
    getAddress,
};
