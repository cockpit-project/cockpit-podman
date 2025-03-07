export const VERSION = "/v1.12/";

const podmanCall = (con, name, method, args, body) => con.call({
    method,
    path: VERSION + name,
    body: body || "",
    params: args,
});

const podmanJson = (con, name, method, args, body) => podmanCall(con, name, method, args, body)
        .then(reply => JSON.parse(reply));

export const streamEvents = (con, callback) => con.monitor(VERSION + "libpod/events", callback);

export function getInfo(con) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("timeout")), 5000);
        podmanJson(con, "libpod/info", "GET", {})
                .then(reply => resolve(reply))
                .catch(reject)
                .finally(() => clearTimeout(timeout));
    });
}

export const getContainers = con => podmanJson(con, "libpod/containers/json", "GET", { all: true });

export const streamContainerStats = (con, callback) => con.monitor(VERSION + "libpod/containers/stats", callback);

export function inspectContainer(con, id) {
    const options = {
        size: false // set true to display filesystem usage
    };
    return podmanJson(con, "libpod/containers/" + id + "/json", "GET", options);
}

export const delContainer = (con, id, force) => podmanCall(con, "libpod/containers/" + id, "DELETE", { force });

export const renameContainer = (con, id, config) => podmanCall(con, "libpod/containers/" + id + "/rename", "POST", config);

export const createContainer = (con, config) => podmanJson(con, "libpod/containers/create", "POST", {}, JSON.stringify(config));

export const commitContainer = (con, commitData) => podmanCall(con, "libpod/commit", "POST", commitData);

export const postContainer = (con, action, id, args) => podmanCall(con, "libpod/containers/" + id + "/" + action, "POST", args);

export const runHealthcheck = (con, id) => podmanCall(con, "libpod/containers/" + id + "/healthcheck", "GET", {});

export const postPod = (con, action, id, args) => podmanCall(con, "libpod/pods/" + id + "/" + action, "POST", args);

export const delPod = (con, id, force) => podmanCall(con, "libpod/pods/" + id, "DELETE", { force });

export const createPod = (con, config) => podmanCall(con, "libpod/pods/create", "POST", {}, JSON.stringify(config));

export function execContainer(con, id) {
    const args = {
        AttachStderr: true,
        AttachStdout: true,
        AttachStdin: true,
        Tty: true,
        Cmd: ["/bin/sh"],
    };

    return podmanJson(con, "libpod/containers/" + id + "/exec", "POST", {}, JSON.stringify(args));
}

export function resizeContainersTTY(con, id, exec, width, height) {
    const args = {
        h: height,
        w: width,
    };

    let point = "containers/";
    if (!exec)
        point = "exec/";

    return podmanCall(con, "libpod/" + point + id + "/resize", "POST", args);
}

function parseImageInfo(info) {
    const image = {};

    if (info.Config) {
        image.Entrypoint = info.Config.Entrypoint;
        image.Command = info.Config.Cmd;
        image.Ports = Object.keys(info.Config.ExposedPorts || {});
        image.Env = info.Config.Env || [];
    }
    image.Author = info.Author;

    return image;
}

export function getImages(con, id) {
    const options = {};
    if (id)
        options.filters = JSON.stringify({ id: [id] });
    return podmanJson(con, "libpod/images/json", "GET", options)
            .then(reply => {
                const images = {};
                const promises = [];

                for (const image of reply) {
                    images[image.Id] = image;
                    promises.push(podmanJson(con, "libpod/images/" + image.Id + "/json", "GET", {}));
                }

                return Promise.all(promises)
                        .then(replies => {
                            for (const info of replies)
                                images[info.Id] = { uid: con.uid, ...images[info.Id], ...parseImageInfo(info) };
                            return images;
                        });
            });
}

export function getPods(con, id) {
    const options = {};
    if (id)
        options.filters = JSON.stringify({ id: [id] });
    return podmanJson(con, "libpod/pods/json", "GET", options);
}

export const delImage = (con, id, force) => podmanJson(con, "libpod/images/" + id, "DELETE", { force });

export const untagImage = (con, id, repo, tag) => podmanCall(con, "libpod/images/" + id + "/untag", "POST", { repo, tag });

export function pullImage(con, reference) {
    return new Promise((resolve, reject) => {
        podmanCall(con, "libpod/images/pull", "POST", { reference })
                .then(r => {
                    // Need to check the last response if it contains error
                    const responses = r.trim().split("\n");
                    const response = JSON.parse(responses[responses.length - 1]);
                    if (response.error) {
                        response.message = response.error;
                        reject(response);
                    } else if (response.cause) // present for 400 and 500 errors
                        reject(response);
                    else
                        resolve();
                })
                .catch(reject);
    });
}

export const pruneUnusedImages = con => podmanJson(con, "libpod/images/prune?all=true", "POST", {});

export const imageHistory = (con, id) => podmanJson(con, `libpod/images/${id}/history`, "GET", {});

export const imageExists = (con, id) => podmanCall(con, "libpod/images/" + id + "/exists", "GET", {});

export const containerExists = (con, id) => podmanCall(con, "libpod/containers/" + id + "/exists", "GET", {});
