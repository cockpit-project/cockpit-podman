import rest from './rest.js';

const PODMAN_SYSTEM_ADDRESS = "/run/podman/podman.sock";
export const VERSION = "/v1.12/";

export function getAddress(system) {
    if (system)
        return PODMAN_SYSTEM_ADDRESS;
    const xrd = sessionStorage.getItem('XDG_RUNTIME_DIR');
    if (xrd)
        return (xrd + "/podman/podman.sock");
    console.warn("$XDG_RUNTIME_DIR is not present. Cannot use user service.");
    return "";
}

function podmanCall(name, method, args, system, body) {
    const options = {
        method: method,
        path: VERSION + name,
        body: body || "",
        params: args,
    };

    return rest.call(getAddress(system), system, options);
}

function podmanMonitor(name, method, args, callback, system) {
    const options = {
        method: method,
        path: VERSION + name,
        body: "",
        params: args,
    };

    const connection = rest.connect(getAddress(system), system);
    return connection.monitor(options, callback, system);
}

export function streamEvents(system, callback) {
    return new Promise((resolve, reject) => {
        podmanMonitor("libpod/events", "GET", {}, callback, system)
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject);
    });
}

export function getInfo(system) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("timeout")), 5000);
        podmanCall("libpod/info", "GET", {}, system)
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject)
                .finally(() => clearTimeout(timeout));
    });
}

export function getContainers(system, id) {
    return new Promise((resolve, reject) => {
        const options = { all: true };
        if (id)
            options.filters = JSON.stringify({ id: [id] });

        podmanCall("libpod/containers/json", "GET", options, system)
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject);
    });
}

export const getContainerStats = (system, callback) => podmanMonitor("libpod/containers/stats", "GET", { stream: true }, callback, system);

export function inspectContainer(system, id) {
    return new Promise((resolve, reject) => {
        const options = {
            size: false // set true to display filesystem usage
        };
        podmanCall("libpod/containers/" + id + "/json", "GET", options, system)
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject);
    });
}

export const delContainer = (system, id, force) => podmanCall("libpod/containers/" + id, "DELETE", { force }, system);

export const renameContainer = (system, id, config) => podmanCall("libpod/containers/" + id + "/rename", "POST", config, system);

export function createContainer(system, config) {
    return new Promise((resolve, reject) => {
        podmanCall("libpod/containers/create", "POST", {}, system, JSON.stringify(config))
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject);
    });
}

export const commitContainer = (system, commitData) => podmanCall("libpod/commit", "POST", commitData, system);

export const postContainer = (system, action, id, args) => podmanCall("libpod/containers/" + id + "/" + action, "POST", args, system);

export const postPod = (system, action, id, args) => podmanCall("libpod/pods/" + id + "/" + action, "POST", args, system);

export const delPod = (system, id, force) => podmanCall("libpod/pods/" + id, "DELETE", { force }, system);

export function execContainer(system, id) {
    const args = {
        AttachStderr: true,
        AttachStdout: true,
        AttachStdin: true,
        Tty: true,
        Cmd: ["/bin/sh"],
    };

    return new Promise((resolve, reject) => {
        podmanCall("libpod/containers/" + id + "/exec", "POST", {}, system, JSON.stringify(args))
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject);
    });
}

export function resizeContainersTTY(system, id, exec, width, height) {
    const args = {
        h: height,
        w: width,
    };

    let point = "containers/";
    if (!exec)
        point = "exec/";

    return podmanCall("libpod/" + point + id + "/resize", "POST", args, system);
}

function parseImageInfo(info) {
    const image = {};

    if (info.Config) {
        image.Entrypoint = info.Config.Entrypoint;
        image.Command = info.Config.Cmd;
        image.Ports = Object.keys(info.Config.ExposedPorts || {});
    }
    image.Author = info.Author;

    return image;
}

export function getImages(system, id) {
    return new Promise((resolve, reject) => {
        const options = {};
        if (id)
            options.filters = JSON.stringify({ id: [id] });
        podmanCall("libpod/images/json", "GET", options, system)
                .then(reply => {
                    const immages = JSON.parse(reply);
                    const images = {};
                    const promises = [];

                    for (const image of immages || []) {
                        images[image.Id] = image;
                        promises.push(podmanCall("libpod/images/" + image.Id + "/json", "GET", {}, system));
                    }

                    Promise.all(promises)
                            .then(replies => {
                                for (const reply of replies) {
                                    const info = JSON.parse(reply);
                                    images[info.Id] = Object.assign(images[info.Id], parseImageInfo(info));
                                    images[info.Id].isSystem = system;
                                }
                                resolve(images);
                            })
                            .catch(reject);
                })
                .catch(reject);
    });
}

export function getPods(system, id) {
    return new Promise((resolve, reject) => {
        const options = {};
        if (id)
            options.filters = JSON.stringify({ id: [id] });
        podmanCall("libpod/pods/json", "GET", options, system)
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject);
    });
}

export function delImage(system, id, force) {
    return new Promise((resolve, reject) => {
        const options = {
            force: force,
        };
        podmanCall("libpod/images/" + id, "DELETE", options, system)
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject);
    });
}

export const untagImage = (system, id, repo, tag) => podmanCall("libpod/images/" + id + "/untag", "POST", { repo, tag }, system);

export function pullImage(system, reference) {
    return new Promise((resolve, reject) => {
        const options = {
            reference: reference,
        };
        podmanCall("libpod/images/pull", "POST", options, system)
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

export function pruneUnusedImages(system) {
    return new Promise((resolve, reject) => {
        podmanCall("libpod/images/prune?all=true", "POST", {}, system).then(resolve)
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject);
    });
}

export const imageExists = (system, id) => podmanCall("libpod/images/" + id + "/exists", "GET", {}, system);
