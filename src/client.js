import rest from './rest.js';

const PODMAN_SYSTEM_ADDRESS = "/run/podman/podman.sock";

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
        path: "/v1.12/" + name,
        body: body || "",
        params: args,
    };

    return rest.call(getAddress(system), system, options);
}

function podmanMonitor(name, method, args, callback, system) {
    const options = {
        method: method,
        path: "/v1.12/" + name,
        body: "",
        params: args,
    };

    const connection = rest.connect(getAddress(system), system);
    return connection.monitor(options, callback, system);
}

export function streamEvents(system, callback) {
    return new Promise((resolve, reject) => {
        podmanMonitor("events", "GET", {}, callback, system)
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject);
    });
}

export function getInfo(system) {
    return new Promise((resolve, reject) => {
        podmanCall("info", "GET", {}, system)
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject);
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

export function getContainerStats(system, id, callback) {
    return new Promise((resolve, reject) => {
        const options = {
            stream: true,
        };
        podmanMonitor("libpod/containers/" + id + "/stats", "GET", options, callback, system)
                .then(resolve, reject);
    });
}

export function delContainer(system, id, force) {
    return new Promise((resolve, reject) => {
        const options = {
            force: force,
        };
        podmanCall("libpod/containers/" + id, "DELETE", options, system)
                .then(resolve)
                .catch(reject);
    });
}

export function createContainer(system, config) {
    return new Promise((resolve, reject) => {
        podmanCall("libpod/containers/create", "POST", {}, system, JSON.stringify(config))
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject);
    });
}

export function commitContainer(system, commitData) {
    return new Promise((resolve, reject) => {
        podmanCall("libpod/commit", "POST", commitData, system)
                .then(resolve)
                .catch(reject);
    });
}

export function postContainer(system, action, id, args) {
    return new Promise((resolve, reject) => {
        podmanCall("libpod/containers/" + id + "/" + action, "POST", args, system)
                .then(resolve)
                .catch(reject);
    });
}

export function resizeContainersTTY(system, id, width, height) {
    const args = {
        h: height,
        w: width,
    };
    return new Promise((resolve, reject) => {
        podmanCall("libpod/containers/" + id + "/resize", "POST", args, system)
                .then(resolve)
                .catch(reject);
    });
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

export function pullImage(system, reference) {
    return new Promise((resolve, reject) => {
        const options = {
            reference: reference,
        };
        podmanCall("libpod/images/pull", "POST", options, system)
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject);
    });
}
