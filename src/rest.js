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

function connect(address, system) {
    /* This doesn't create a channel until a request */
    /* HACK: use binary channel to work around https://github.com/cockpit-project/cockpit/issues/19235 */
    const http = cockpit.http(address, { superuser: system ? "require" : null, binary: true });
    const connection = {};
    const decoder = new TextDecoder();

    connection.monitor = function(options, callback, system, return_raw) {
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
                                debug(system, "monitor", line_str);
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
        debug(system, `call ${id}:`, JSON.stringify(options));
        return new Promise((resolve, reject) => {
            options = options || {};
            http.request(options)
                    .then(result => {
                        const text = decoder.decode(result);
                        debug(system, `call ${id} result:`, text);
                        resolve(text);
                    })
                    .catch((error, content) => {
                        const text = decoder.decode(content);
                        debug(system, `call ${id} error:`, JSON.stringify(error), "content", text);
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
async function call (address, system, parameters) {
    const connection = connect(address, system);
    const result = await connection.call(parameters);
    connection.close();
    return result;
}

export default {
    connect,
    call
};
