import cockpit from 'cockpit';
import varlink from './varlink.js';

const _ = cockpit.gettext;

export const PODMAN_ADDRESS = "unix:/run/podman/io.podman";

export function truncate_id(id) {
    if (!id) {
        return _("");
    }
    return _(id.substr(0, 12));
}

export function format_cpu_percent(cpuPercent) {
    if (cpuPercent === undefined || isNaN(cpuPercent)) {
        return _("");
    }
    return _(cpuPercent.toFixed() + "%");
}

export function format_memory_and_limit(usage, limit) {
    if (usage === undefined || isNaN(usage))
        return _("");

    var mtext = "";
    var units = 1024;
    var parts;
    if (limit) {
        parts = cockpit.format_bytes(limit, units, true);
        mtext = " / " + parts.join(" ");
        units = parts[1];
    }

    if (usage) {
        parts = cockpit.format_bytes(usage, units, true);
        if (mtext)
            return _(parts[0] + mtext);
        else
            return _(parts.join(" "));
    } else {
        return _("");
    }
}

// TODO: handle different kinds of errors
function handleVarlinkCallError(ex) {
    console.error("Failed to do varlinkcall:", JSON.stringify(ex));
}

export function updateContainers() {
    return varlink.call(PODMAN_ADDRESS, "io.podman.ListContainers")
            .then(reply => {
                let containers = {};
                let promises = [];

                for (let container of reply.containers || []) {
                    containers[container.id] = container;
                    if (container.status === "running")
                        promises.push(varlink.call(PODMAN_ADDRESS, "io.podman.GetContainerStats", { name: container.id }));
                }

                return Promise.all(promises)
                        .then(replies => {
                            let stats = {};
                            for (let reply of replies)
                                stats[reply.container.id] = reply.container;

                            return { newContainers: containers, newContainersStats: stats };
                        });
            })
            .catch(ex => {
                handleVarlinkCallError(ex);
                throw ex;
            });
}

export function updateImages() {
    let newImages = {};
    return new Promise((resolve, reject) => {
        varlink.call(PODMAN_ADDRESS, "io.podman.ListImages")
                .then(reply => {
                    let newImagesMeta = reply.images || [];
                    let inspectRet = newImagesMeta.map(img => varlink.call(PODMAN_ADDRESS, "io.podman.InspectImage", {name: img.id}));
                    Promise.all(inspectRet)
                            .then(replies => {
                                replies.map(reply => {
                                    let imgInspectRet = JSON.parse(reply.image);
                                    newImages[imgInspectRet.Id] = imgInspectRet;
                                });
                                resolve(newImages);
                            })
                            .catch(ex => {
                                handleVarlinkCallError(ex);
                                reject(ex);
                            });
                })
                .catch(ex => {
                    handleVarlinkCallError(ex);
                    reject(ex);
                });
    });
}

export function getCommitArr(arr, cmd) {
    let ret = [];
    if (cmd === "ONBUILD") {
        for (let i = 0; i < arr.length; i++) {
            let temp = "ONBUILD=" + arr[i];
            ret.push(temp);
        }
    }
    return ret;
}
