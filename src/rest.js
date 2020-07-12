import cockpit from "cockpit";

function manage_error(reject, error, content) {
    let message = "";
    if (content) {
        try {
            message = JSON.parse(content).message;
        } catch (e) {
            message = content;
        }
    }
    const c = { ...error };
    if (message)
        c.message = message;
    reject(c);
}

function connect(address, system) {
    /* This doesn't create a channel until a request */
    const http = cockpit.http(address, { superuser: system ? "require" : null });
    const connection = {};

    connection.monitor = function(options, callback, system, return_raw) {
        return new Promise((resolve, reject) => {
            http.request(options)
                    .stream(data => {
                        if (return_raw)
                            callback(data);
                        else
                            callback(JSON.parse(data));
                    })
                    .catch((error, content) => {
                        manage_error(reject, error, content);
                    })
                    .then(resolve);
        });
    };

    connection.call = function (options) {
        return new Promise((resolve, reject) => {
            options = options || {};
            http.request(options)
                    .then(resolve)
                    .catch((error, content) => {
                        manage_error(reject, error, content);
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
