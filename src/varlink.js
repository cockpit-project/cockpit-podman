
import cockpit from "cockpit";

const encoder = cockpit.utf8_encoder();
const decoder = cockpit.utf8_decoder();

/*
 * Connect to a varlink service.
 *
 * Returns a connection object:
 *
 * - connection.call(method, parameters) calls "method" (prefixed by the
 *   interface) with "parameters". Multiple calls can be made without waiting
 *   for replies, but calls are made sequentially (similar to http). Returns a
 *   promise that resolves with the return value of the method or a tuple
 *   (varlinkerror, parameters).
 *
 * - connection.close() rejects all pending calls and closes the connection.
 *
 * - connection.onclosed is called when the connection is closed.
 *
 * https://varlink.org
 */
function connect(address) {
    if (!address.startsWith("unix:"))
        throw new Error("Only unix varlink connections supported");

    let connection = {};
    let pending = [];
    let buffer = "";

    let channel = cockpit.channel({
        unix: address.slice(5),
        binary: true,
        payload: "stream",
        superuser: "require"
    });

    channel.addEventListener("message", (event, data) => {
        buffer += decoder.decode(data);

        const chunks = buffer.split("\0");
        buffer = chunks.pop();

        for (let i = 0; i < chunks.length; i += 1) {
            const message = JSON.parse(chunks[i]);

            let { resolve, reject } = pending.shift();
            if (message.error)
                reject({
                    error: message.error,
                    parameters: message.parameters
                });
            else
                resolve(message.parameters);
        }
    });

    channel.addEventListener("close", (event, options) => {
        if (connection.onclosed)
            connection.onclosed(options.problem);
    });

    connection.call = function (method, parameters) {
        parameters = parameters || {};

        const data = encoder.encode(JSON.stringify({ method, parameters }));

        channel.send(data);
        channel.send([0]);

        return new Promise((resolve, reject) => pending.push({ resolve, reject }));
    };

    connection.close = function () {
        pending.forEach(p => p.reject({ error: "ConnectionClosed" }));
        channel.close();
    };

    return connection;
}

/*
 * Connects to a varlink service, performs a single call, and closes the
 * connection.
 */
async function call (address, method, parameters) {
    let connection = await connect(address);
    let result = await connection.call(method, parameters);
    connection.close();
    return result;
}

export default {
    connect,
    call
};
