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
        method,
        path: VERSION + name,
        body: body || "",
        params: args,
    };

    return rest.call(getAddress(system), system, options);
}

const podmanJson = (name, method, args, system, body) => podmanCall(name, method, args, system, body)
        .then(reply => JSON.parse(reply));

function podmanMonitor(name, method, args, callback, system) {
    const options = {
        method,
        path: VERSION + name,
        body: "",
        params: args,
    };

    const connection = rest.connect(getAddress(system), system);
    return connection.monitor(options, callback, system);
}

export const streamEvents = (system, callback) => podmanMonitor("libpod/events", "GET", {}, callback, system);

export function getInfo(system) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("timeout")), 5000);
        podmanJson("libpod/info", "GET", {}, system)
                .then(reply => resolve(reply))
                .catch(reject)
                .finally(() => clearTimeout(timeout));
    });
}

export const getContainers = system => podmanJson("libpod/containers/json", "GET", { all: true }, system);

export const streamContainerStats = (system, callback) => podmanMonitor("libpod/containers/stats", "GET", { stream: true }, callback, system);

export function inspectContainer(system, id) {
    const options = {
        size: false // set true to display filesystem usage
    };
    return podmanJson("libpod/containers/" + id + "/json", "GET", options, system);
}

export const delContainer = (system, id, force) => podmanCall("libpod/containers/" + id, "DELETE", { force }, system);

export const renameContainer = (system, id, config) => podmanCall("libpod/containers/" + id + "/rename", "POST", config, system);

export const createContainer = (system, config) => podmanJson("libpod/containers/create", "POST", {}, system, JSON.stringify(config));

export const commitContainer = (system, commitData) => podmanCall("libpod/commit", "POST", commitData, system);

export const postContainer = (system, action, id, args) => podmanCall("libpod/containers/" + id + "/" + action, "POST", args, system);

export const runHealthcheck = (system, id) => podmanCall("libpod/containers/" + id + "/healthcheck", "GET", {}, system);

export const postPod = (system, action, id, args) => podmanCall("libpod/pods/" + id + "/" + action, "POST", args, system);

export const delPod = (system, id, force) => podmanCall("libpod/pods/" + id, "DELETE", { force }, system);

export const createPod = (system, config) => podmanCall("libpod/pods/create", "POST", {}, system, JSON.stringify(config));

export function execContainer(system, id) {
    const args = {
        AttachStderr: true,
        AttachStdout: true,
        AttachStdin: true,
        Tty: true,
        Cmd: ["/bin/sh"],
    };

    return podmanJson("libpod/containers/" + id + "/exec", "POST", {}, system, JSON.stringify(args));
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
        image.Env = info.Config.Env || [];
    }
    image.Author = info.Author;

    return image;
}

export function getImages(system, id) {
    const options = {};
    if (id)
        options.filters = JSON.stringify({ id: [id] });
    return podmanJson("libpod/images/json", "GET", options, system)
            .then(reply => {
                const images = {};
                const promises = [];

                for (const image of reply) {
                    images[image.Id] = image;
                    promises.push(podmanJson("libpod/images/" + image.Id + "/json", "GET", {}, system));
                }

                return Promise.all(promises)
                        .then(replies => {
                            for (const info of replies) {
                                images[info.Id] = Object.assign(images[info.Id], parseImageInfo(info));
                                images[info.Id].isSystem = system;
                            }
                            return images;
                        });
            });
}

export function getPods(system, id) {
    const options = {};
    if (id)
        options.filters = JSON.stringify({ id: [id] });
    return podmanJson("libpod/pods/json", "GET", options, system);
}

export const delImage = (system, id, force) => podmanJson("libpod/images/" + id, "DELETE", { force }, system);

export const untagImage = (system, id, repo, tag) => podmanCall("libpod/images/" + id + "/untag", "POST", { repo, tag }, system);

export function pullImage(system, reference) {
    return new Promise((resolve, reject) => {
        podmanCall("libpod/images/pull", "POST", { reference }, system)
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

export const pruneUnusedImages = system => podmanJson("libpod/images/prune?all=true", "POST", {}, system);

export const imageHistory = (system, id) => podmanJson(`libpod/images/${id}/history`, "GET", {}, system);

export const imageExists = (system, id) => podmanCall("libpod/images/" + id + "/exists", "GET", {}, system);

export const containerExists = (system, id) => podmanCall("libpod/containers/" + id + "/exists", "GET", {}, system);

export const getVolumes = system => podmanJson("libpod/volumes/json", "GET", {}, system);
