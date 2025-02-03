import rest from './rest.js';

export const VERSION = "/v1.12/";

function podmanCall(name, method, args, uid, body) {
    const options = {
        method,
        path: VERSION + name,
        body: body || "",
        params: args,
    };

    return rest.call(uid, options);
}

const podmanJson = (name, method, args, uid, body) => podmanCall(name, method, args, uid, body)
        .then(reply => JSON.parse(reply));

function podmanMonitor(name, method, args, callback, uid) {
    const options = {
        method,
        path: VERSION + name,
        body: "",
        params: args,
    };

    const connection = rest.connect(uid);
    return connection.monitor(options, callback);
}

export const streamEvents = (uid, callback) => podmanMonitor("libpod/events", "GET", {}, callback, uid);

export function getInfo(uid) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("timeout")), 5000);
        podmanJson("libpod/info", "GET", {}, uid)
                .then(reply => resolve(reply))
                .catch(reject)
                .finally(() => clearTimeout(timeout));
    });
}

export const getContainers = uid => podmanJson("libpod/containers/json", "GET", { all: true }, uid);

export const streamContainerStats = (uid, callback) => podmanMonitor("libpod/containers/stats", "GET", { stream: true }, callback, uid);

export function inspectContainer(uid, id) {
    const options = {
        size: false // set true to display filesystem usage
    };
    return podmanJson("libpod/containers/" + id + "/json", "GET", options, uid);
}

export const delContainer = (uid, id, force) => podmanCall("libpod/containers/" + id, "DELETE", { force }, uid);

export const renameContainer = (uid, id, config) => podmanCall("libpod/containers/" + id + "/rename", "POST", config, uid);

export const createContainer = (uid, config) => podmanJson("libpod/containers/create", "POST", {}, uid, JSON.stringify(config));

export const commitContainer = (uid, commitData) => podmanCall("libpod/commit", "POST", commitData, uid);

export const postContainer = (uid, action, id, args) => podmanCall("libpod/containers/" + id + "/" + action, "POST", args, uid);

export const runHealthcheck = (uid, id) => podmanCall("libpod/containers/" + id + "/healthcheck", "GET", {}, uid);

export const postPod = (uid, action, id, args) => podmanCall("libpod/pods/" + id + "/" + action, "POST", args, uid);

export const delPod = (uid, id, force) => podmanCall("libpod/pods/" + id, "DELETE", { force }, uid);

export const createPod = (uid, config) => podmanCall("libpod/pods/create", "POST", {}, uid, JSON.stringify(config));

export function execContainer(uid, id) {
    const args = {
        AttachStderr: true,
        AttachStdout: true,
        AttachStdin: true,
        Tty: true,
        Cmd: ["/bin/sh"],
    };

    return podmanJson("libpod/containers/" + id + "/exec", "POST", {}, uid, JSON.stringify(args));
}

export function resizeContainersTTY(uid, id, exec, width, height) {
    const args = {
        h: height,
        w: width,
    };

    let point = "containers/";
    if (!exec)
        point = "exec/";

    return podmanCall("libpod/" + point + id + "/resize", "POST", args, uid);
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

export function getImages(uid, id) {
    const options = {};
    if (id)
        options.filters = JSON.stringify({ id: [id] });
    return podmanJson("libpod/images/json", "GET", options, uid)
            .then(reply => {
                const images = {};
                const promises = [];

                for (const image of reply) {
                    images[image.Id] = image;
                    promises.push(podmanJson("libpod/images/" + image.Id + "/json", "GET", {}, uid));
                }

                return Promise.all(promises)
                        .then(replies => {
                            for (const info of replies)
                                images[info.Id] = { uid, ...images[info.Id], ...parseImageInfo(info) };
                            return images;
                        });
            });
}

export function getPods(uid, id) {
    const options = {};
    if (id)
        options.filters = JSON.stringify({ id: [id] });
    return podmanJson("libpod/pods/json", "GET", options, uid);
}

export const delImage = (uid, id, force) => podmanJson("libpod/images/" + id, "DELETE", { force }, uid);

export const untagImage = (uid, id, repo, tag) => podmanCall("libpod/images/" + id + "/untag", "POST", { repo, tag }, uid);

export function pullImage(uid, reference) {
    return new Promise((resolve, reject) => {
        podmanCall("libpod/images/pull", "POST", { reference }, uid)
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

export const pruneUnusedImages = uid => podmanJson("libpod/images/prune?all=true", "POST", {}, uid);

export const imageHistory = (uid, id) => podmanJson(`libpod/images/${id}/history`, "GET", {}, uid);

export const imageExists = (uid, id) => podmanCall("libpod/images/" + id + "/exists", "GET", {}, uid);

export const containerExists = (uid, id) => podmanCall("libpod/containers/" + id + "/exists", "GET", {}, uid);
