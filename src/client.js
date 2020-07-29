import cockpit from 'cockpit';
import rest from './rest.js';
import { downloadFile } from "./util.js";

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
        podmanCall("libpod/info", "GET", {}, system)
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

export function postPod(system, action, id, args) {
    return new Promise((resolve, reject) => {
        podmanCall("libpod/pods/" + id + "/" + action, "POST", args, system)
                .then(resolve)
                .catch(reject);
    });
}

export function delPod(system, id, force) {
    return new Promise((resolve, reject) => {
        const options = {
            force: force,
        };
        podmanCall("libpod/pods/" + id, "DELETE", options, system)
                .then(resolve)
                .catch(reject);
    });
}

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

export async function postContainerAndSave(system, action, id, args) {
    let file;
    try {
        file = (await cockpit.script("mktemp -p /var/tmp")).slice(0, -1);
    } catch {
        throw new Error("Failed to create temporary file");
    }

    const saveChannel = cockpit.channel({
        payload: "fsreplace1",
        path: file,
        binary: true
    });
    await saveChannel.wait();

    const options = {
        method: "POST",
        path: VERSION + "libpod/containers/" + id + "/" + action,
        body: "",
        params: args,
        redirect: saveChannel.id,
        binary: true
    };
    try {
        await rest.call(getAddress(system), system, options);
        saveChannel.control({ command: "done" });
    } catch {
        saveChannel.control({ command: "done" });
        await new Promise(resolve => saveChannel.addEventListener("close", resolve));

        const errorFile = cockpit.file(file);
        const error = await errorFile.read();
        errorFile.close();
        throw new Error(error);
    }

    await new Promise(resolve => saveChannel.addEventListener("close", resolve));

    return file;
}

export function postContainerAndDownload(system, action, id, filename, args) {
    return new Promise((resolve, reject) => {
        postContainerAndSave(system, action, id, args)
                .then(path => {
                    console.log(path);
                    downloadFile(path, filename);
                    resolve();
                })
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

    return new Promise((resolve, reject) => {
        podmanCall("libpod/" + point + id + "/resize", "POST", args, system)
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

export function untagImage(system, id, repo, tag) {
    return new Promise((resolve, reject) => {
        const options = {
            repo: repo,
            tag: tag
        };
        podmanCall("libpod/images/" + id + "/untag", "POST", options, system)
                .then(resolve)
                .catch(reject);
    });
}

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
