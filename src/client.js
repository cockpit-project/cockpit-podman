import cockpit from "cockpit";
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

function podmanCall(name, method, args, system, host, body) {
    const options = {
        method: method,
        path: VERSION + name,
        body: body || "",
        params: args,
    };

    return rest.call(getAddress(system), system, options, host);
}

function podmanMonitor(name, method, args, callback, system, host) {
    const options = {
        method: method,
        path: VERSION + name,
        body: "",
        params: args,
    };

    const connection = rest.connect(getAddress(system), system, host);
    return connection.monitor(options, callback, system);
}

function podmanTransfer(name, method, args, system, target, host) {
    const options = {
        method: method,
        path: VERSION + name,
        body: "",
        params: args,
        redirect: target,
        binary: true,
    };

    return rest.call(getAddress(system), system, options, host);
}

export function streamEvents(system, callback, host) {
    return new Promise((resolve, reject) => {
        podmanMonitor("libpod/events", "GET", {}, callback, system, host)
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject);
    });
}

export function getInfo(system, host) {
    return new Promise((resolve, reject) => {
        podmanCall("libpod/info", "GET", {}, system, host)
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject);
    });
}

export function getContainers(system, id, host) {
    return new Promise((resolve, reject) => {
        const options = { all: true };
        if (id)
            options.filters = JSON.stringify({ id: [id] });

        podmanCall("libpod/containers/json", "GET", options, system, host)
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject);
    });
}

export function getContainerStats(system, id, callback, host) {
    return new Promise((resolve, reject) => {
        const options = {
            stream: true,
        };
        podmanMonitor("libpod/containers/" + id + "/stats", "GET", options, callback, system, host)
                .then(resolve, reject);
    });
}

export function inspectContainer(system, id, host) {
    return new Promise((resolve, reject) => {
        const options = {
            size: false // set true to display filesystem usage
        };
        podmanCall("libpod/containers/" + id + "/json", "GET", options, system, host)
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject);
    });
}

export function delContainer(system, id, force, host) {
    return new Promise((resolve, reject) => {
        const options = {
            force: force,
        };
        podmanCall("libpod/containers/" + id, "DELETE", options, system, host)
                .then(resolve)
                .catch(reject);
    });
}

export function createContainer(system, config, host) {
    return new Promise((resolve, reject) => {
        podmanCall("libpod/containers/create", "POST", {}, system, host, JSON.stringify(config))
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject);
    });
}

export function commitContainer(system, commitData, host) {
    return new Promise((resolve, reject) => {
        podmanCall("libpod/commit", "POST", commitData, system, host)
                .then(resolve)
                .catch(reject);
    });
}

export async function migrateContainer(system, id, targetId, args, targetHost, callbacks, host) {
    if (!system) {
        throw new Error(`${id}: migrating non-system container unsupported`);
    }

    callbacks = Object.assign({
        imageInspect: () => {},
        imageExport: () => {},
        imageImport: () => {},
        imageTagging: () => {},
        containerInspect: () => {},
        containerExport: () => {},
        containerCreate: () => {},
        containerImport: () => {}
    }, callbacks);

    // Make sure Podman system service is present and active on target host
    const systemd = cockpit.dbus("org.freedesktop.systemd1", { bus: "system", host: targetHost });
    await systemd.wait();
    const podmanSocketPath = await systemd.call("/org/freedesktop/systemd1", "org.freedesktop.systemd1.Manager",
                                                "GetUnit", ["podman.socket"]);
    const podmanSocket = systemd.proxy("org.freedesktop.systemd1.Unit", podmanSocketPath[0]);
    await podmanSocket.wait();
    if (podmanSocket.ActiveState !== "active")
        throw new Error("Podman system service not active on target host");

    // Make sure the image the container uses is present on the target host
    const containerInfo = await inspectContainer(system, id, host);
    try {
        callbacks.imageInspect();
        await inspectImage(system, containerInfo.Image, targetHost);
    } catch (error) {
        if (error.status === 404) {
            // Image not found - try to copy it to the target host
            callbacks.imageExport();
            const imageFile = (await cockpit.script("mktemp -p /var/tmp", { host: targetHost })).slice(0, -1);
            const imageSaveChannel = cockpit.channel({
                payload: "fsreplace1",
                path: imageFile,
                binary: true,
                host: targetHost
            });
            await imageSaveChannel.wait();
            await exportImage(system, containerInfo.Image, { format: "docker-archive", compress: true }, host,
                              imageSaveChannel.id);
            imageSaveChannel.control({ command: "done" });
            await new Promise(resolve => imageSaveChannel.addEventListener("close", resolve));

            callbacks.imageImport();
            try {
                let imageLoadChannelData = null;
                let imageLoadChannelResponse = null;

                const imageFileSize = await cockpit.script(`stat --printf="%s" "${imageFile}"`, { host: targetHost });
                const imageLoadChannel = cockpit.channel({
                    payload: "http-stream2",
                    unix: "/run/podman/podman.sock",
                    method: "POST",
                    path: VERSION + "libpod/images/load",
                    binary: true,
                    "body-length": parseInt(imageFileSize),
                    superuser: "require",
                    host: targetHost
                });
                imageLoadChannel.addEventListener("message", function (e, data) {
                    imageLoadChannelData = data;
                });
                imageLoadChannel.addEventListener("control", function (e, options) {
                    if (options.command === "response")
                        imageLoadChannelResponse = options;
                });
                await imageLoadChannel.wait();
                const imageReadChannel = cockpit.channel({
                    payload: "fsread1",
                    path: imageFile,
                    max_read_size: parseInt(imageFileSize),
                    redirect: imageLoadChannel.id,
                    binary: true,
                    host: targetHost
                });
                await imageReadChannel.wait();
                await new Promise(resolve =>
                    imageReadChannel.addEventListener("control", function (e, options) {
                        if (options.command === "done")
                            resolve();
                    })
                );
                imageLoadChannel.control({ command: "done" });
                await new Promise((resolve, reject) =>
                    imageLoadChannel.addEventListener("close", function (e, options) {
                        if (options.problem)
                            reject(new Error(options.problem));
                        else if (imageLoadChannelResponse.status >= 200 && imageLoadChannelResponse.status <= 299)
                            resolve();
                        else
                            reject(new Error(String.fromCharCode.apply(null, imageLoadChannelData)));
                    })
                );
            } finally {
                await cockpit.script(`rm "${imageFile}"`, { host: targetHost });
            }

            // Inspect the old image and try to tag the new one to match it
            callbacks.imageTagging();
            const oldImageInfo = await inspectImage(system, containerInfo.Image, host);
            for (const tag of oldImageInfo.RepoTags) {
                const i = tag.lastIndexOf(":");
                try {
                    await tagImage(system, containerInfo.Image, tag.substring(0, i), tag.substring(i + 1, tag.length),
                                   targetHost);
                } catch (error) {
                    // Ignore
                }
            }
        } else {
            throw error;
        }
    }

    let containerCreated = false;
    try {
        callbacks.containerInspect();
        await inspectContainer(system, targetId, targetHost);
    } catch (error) {
        if (error.status === 404) {
            callbacks.containerCreate();
            const dummyConfig = {
                name: targetId,
                image: containerInfo.Image,
                terminal: true,
                command: containerInfo.Args
            };
            await createContainer(system, dummyConfig, targetHost);
            containerCreated = true;
        } else {
            throw error;
        }
    }

    // Checkpoint the selected container
    callbacks.containerExport();
    const containerFile = (await cockpit.script("mktemp -p /var/tmp", { host: targetHost })).slice(0, -1);
    const containerSaveChannel = cockpit.channel({
        payload: "fsreplace1",
        path: containerFile,
        binary: true,
        host: targetHost
    });
    await containerSaveChannel.wait();
    const checkpointArgs = {
        keep: args.keep,
        leaveRunning: args.leaveRunning,
        tcpEstablished: args.tcpEstablished,
        ignoreRootFS: args.ignoreRootFS,
        ignoreStaticIP: args.ignoreStaticIP,
        ignoreStaticMAC: args.ignoreStaticMAC
    };

    try {
        await exportContainer(system, id, checkpointArgs, host, containerSaveChannel.id);
    } catch {
        // The error gets written into the checkpoint file (because of the redirect).
        // In order for it to be correctly reported, it has to be read from the file.
        containerSaveChannel.control({ command: "done" });
        await new Promise(resolve => containerSaveChannel.addEventListener("close", resolve));

        const errorFile = cockpit.file(containerFile, { host: targetHost });
        const error = await errorFile.read();
        errorFile.close();
        throw new Error(error);
    }

    containerSaveChannel.control({ command: "done" });
    await new Promise(resolve => containerSaveChannel.addEventListener("close", resolve));

    // Restore it into the created dummy container
    callbacks.containerImport();
    try {
        let containerImportChannelData = null;
        let containerImportChannelResponse = null;
        const containerFileSize = await cockpit.script(`stat --printf="%s" "${containerFile}"`, { host: targetHost });

        const containerImportChannel = cockpit.channel({
            payload: "http-stream2",
            unix: "/run/podman/podman.sock",
            method: "POST",
            path: VERSION + `libpod/containers/${targetId}/restore?import=true&keep=${args.keep}&` +
                `tcpEstablished=${args.tcpEstablished}&leaveRunning=${args.leaveRunning}&` +
                `ignoreRootFS=${args.ignoreRootFS}`,
            binary: true,
            "body-length": parseInt(containerFileSize),
            superuser: "require",
            host: targetHost
        });
        containerImportChannel.addEventListener("message", function (e, data) {
            containerImportChannelData = data;
        });
        containerImportChannel.addEventListener("control", function (e, options) {
            if (options.command === "response")
                containerImportChannelResponse = options;
        });
        await containerImportChannel.wait();
        const containerReadChannel = cockpit.channel({
            payload: "fsread1",
            path: containerFile,
            max_read_size: parseInt(containerFileSize),
            redirect: containerImportChannel.id,
            binary: true,
            host: targetHost
        });
        await containerReadChannel.wait();
        await new Promise(resolve => containerReadChannel.addEventListener("control", function (e, options) {
            if (options.command === "done")
                resolve();
        }));
        containerImportChannel.control({ command: "done" });
        await new Promise((resolve, reject) =>
            containerImportChannel.addEventListener("close", function (e, options) {
                if (options.problem)
                    reject(new Error(options.problem));
                else if (containerImportChannelResponse.status >= 200 && containerImportChannelResponse.status <= 299)
                    resolve();
                else
                    reject(new Error(String.fromCharCode.apply(null, containerImportChannelData)));
            })
        );
    } catch (e) {
        if (containerCreated)
            await delContainer(system, targetId, true, targetHost);
        throw e;
    } finally {
        await cockpit.script(`rm "${containerFile}"`, { host: targetHost });
    }
}

export function postContainer(system, action, id, args, host) {
    return new Promise((resolve, reject) => {
        podmanCall("libpod/containers/" + id + "/" + action, "POST", args, system, host)
                .then(resolve)
                .catch(reject);
    });
}

export function exportContainer(system, id, options, host, targetChannel) {
    const newArgs = Object.assign({}, options);
    newArgs.export = true;

    return new Promise((resolve, reject) => {
        if (targetChannel === undefined) {
            podmanCall("libpod/containers/" + id + "/checkpoint", "POST", newArgs, system, host)
                    .then(resolve)
                    .catch(reject);
        } else {
            podmanTransfer("libpod/containers/" + id + "/checkpoint", "POST", newArgs, system,
                           targetChannel, host)
                    .then(resolve)
                    .catch(reject);
        }
    });
}

export function postPod(system, action, id, args, host) {
    return new Promise((resolve, reject) => {
        podmanCall("libpod/pods/" + id + "/" + action, "POST", args, system, host)
                .then(resolve)
                .catch(reject);
    });
}

export function delPod(system, id, force, host) {
    return new Promise((resolve, reject) => {
        const options = {
            force: force,
        };
        podmanCall("libpod/pods/" + id, "DELETE", options, system, host)
                .then(resolve)
                .catch(reject);
    });
}

export function execContainer(system, id, host) {
    const args = {
        AttachStderr: true,
        AttachStdout: true,
        AttachStdin: true,
        Tty: true,
        Cmd: ["/bin/sh"],
    };

    return new Promise((resolve, reject) => {
        podmanCall("libpod/containers/" + id + "/exec", "POST", {}, system, host, JSON.stringify(args))
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject);
    });
}

export function resizeContainersTTY(system, id, exec, width, height, host) {
    const args = {
        h: height,
        w: width,
    };

    let point = "containers/";
    if (!exec)
        point = "exec/";

    return new Promise((resolve, reject) => {
        podmanCall("libpod/" + point + id + "/resize", "POST", args, system, host)
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

export function getImages(system, id, host) {
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
                        promises.push(podmanCall("libpod/images/" + image.Id + "/json", "GET", {}, system, host));
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

export function getPods(system, id, host) {
    return new Promise((resolve, reject) => {
        const options = {};
        if (id)
            options.filters = JSON.stringify({ id: [id] });
        podmanCall("libpod/pods/json", "GET", options, system, host)
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject);
    });
}

export function delImage(system, id, force, host) {
    return new Promise((resolve, reject) => {
        const options = {
            force: force,
        };
        podmanCall("libpod/images/" + id, "DELETE", options, system, host)
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject);
    });
}

export function tagImage(system, id, repo, tag, host) {
    return new Promise((resolve, reject) => {
        const options = {
            repo: repo,
            tag: tag
        };
        podmanCall("libpod/images/" + id + "/tag", "POST", options, system, host)
                .then(resolve)
                .catch(reject);
    });
}

export function untagImage(system, id, repo, tag, host) {
    return new Promise((resolve, reject) => {
        const options = {
            repo: repo,
            tag: tag
        };
        podmanCall("libpod/images/" + id + "/untag", "POST", options, system, host)
                .then(resolve)
                .catch(reject);
    });
}

export function pullImage(system, reference, host) {
    return new Promise((resolve, reject) => {
        const options = {
            reference: reference,
        };
        podmanCall("libpod/images/pull", "POST", options, system, host)
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

export function inspectImage(system, id, host) {
    return new Promise((resolve, reject) => {
        podmanCall("libpod/images/" + id + "/json", "GET", {}, system, host)
                .then(reply => resolve(JSON.parse(reply)))
                .catch(reject);
    });
}

export function exportImage(system, id, options, host, targetChannel) {
    return new Promise((resolve, reject) => {
        if (targetChannel === undefined) {
            podmanCall("libpod/images/" + id + "/get", "GET", options, system, host)
                    .then(resolve)
                    .catch(reject);
        } else {
            podmanTransfer("libpod/images/" + id + "/get", "GET", options, system, targetChannel, host)
                    .then(resolve)
                    .catch(reject);
        }
    });
}
