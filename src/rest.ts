import cockpit from "cockpit";

import { debug } from "./util.tsx";

type JsonObject = cockpit.JsonObject;

// make this `unknown` to conveniently call it on raw error objects
function format_error(error: object, content: unknown): object {
    let content_o: JsonObject = {};
    if (typeof content === 'string') {
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

export type MonitorCallbackJson = (data: JsonObject) => void;
export type MonitorCallbackRaw = (data: Uint8Array) => void;
export type MonitorCallback = MonitorCallbackJson | MonitorCallbackRaw;

// type predicate helper for narrowing which monitor callback is being used
function isReturnRaw(return_raw: boolean, callback: MonitorCallback): callback is MonitorCallbackRaw {
    return return_raw;
}

export type Connection = {
    monitor: (options: JsonObject, callback: MonitorCallback, system: boolean, return_raw?: boolean) => Promise<void>;
    call: (options: JsonObject) => Promise<string>;
    close: () => void;
};

function connect(address: string, system: boolean): Connection {
    /* This doesn't create a channel until a request */
    /* HACK: use binary channel to work around https://github.com/cockpit-project/cockpit/issues/19235 */
    /* @ts-expect-error: cockpit.http not typed yet */
    const http = cockpit.http(address, { superuser: system ? "require" : null, binary: true });
    const decoder = new TextDecoder();

    const monitor = function(options: JsonObject, callback: MonitorCallback, system: boolean, return_raw: boolean = false): Promise<void> {
        return new Promise((resolve, reject) => {
            let buffer = new Uint8Array();

            http.request(options)
                    .stream((data: Uint8Array) => {
                        if (isReturnRaw(return_raw, callback))
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
                    .catch((error: object, content: unknown) => reject(format_error(error, content)))
                    .then(resolve);
        });
    };

    const call = function (options: JsonObject): Promise<string> {
        const id = call_id++;
        debug(system, `call ${id}:`, JSON.stringify(options));
        return new Promise((resolve, reject) => {
            options = options || {};
            http.request(options)
                    .then((result: Uint8Array) => {
                        const text = decoder.decode(result);
                        debug(system, `call ${id} result:`, text);
                        resolve(text);
                    })
                    .catch((error: object, content?: Uint8Array) => {
                        const text = content ? decoder.decode(content) : "";
                        debug(system, `call ${id} error:`, JSON.stringify(error), "content", text);
                        reject(format_error(error, text));
                    });
        });
    };

    const close = () => http.close();

    return { monitor, call, close };
}

/*
 * Connects to the podman service, performs a single call, and closes the
 * connection.
 */
async function call (address: string, system: boolean, parameters: JsonObject): Promise<string> {
    const connection = connect(address, system);
    const result = await connection.call(parameters);
    connection.close();
    return result;
}

export default {
    connect,
    call
};
