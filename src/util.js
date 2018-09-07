import cockpit from 'cockpit';
/***
 * varlink protocol helpers
 * https://github.com/varlink/varlink.github.io/wiki
 */
const encoder = cockpit.utf8_encoder();
const decoder = cockpit.utf8_decoder(true);
const _ = cockpit.gettext;

export const PODMAN = { unix: "/run/podman/io.podman" };
/**
 * Do a varlink call on an existing channel. You must *never* call this
 * multiple times in parallel on the same channel! Serialize the calls or use
 * `varlinkCall()`.
 *
 * Returns a promise that resolves with the result parameters or rejects with
 * an error message.
 */
function varlinkCallChannel(channel, method, parameters) {
    return new Promise((resolve, reject) => {
        function on_close(event, options) {
            reject(options.problem || options);
        }

        function on_message(event, data) {
            channel.removeEventListener("message", on_message);
            channel.removeEventListener("close", on_close);

            // FIXME: support answer in multiple chunks until null byte
            if (data[data.length - 1] != 0) {
                reject(new Error("protocol error: expecting terminating 0"));
                return;
            }

            var reply = decoder.decode(data.slice(0, -1));
            var json = JSON.parse(reply);
            if (json.error) {
                let msg = varlinkCallError(json);
                reject(msg);
            } else if (json.parameters) {
                // debugging
                resolve(json.parameters);
            } else
                reject(new Error("protocol error: reply has neither parameters nor error: " + reply));
        }

        channel.addEventListener("close", on_close);
        channel.addEventListener("message", on_message);
        channel.send(encoder.encode(JSON.stringify({ method, parameters: (parameters || {}) })));
        channel.send([0]); // message separator
    });
}

function varlinkCallError(error) {
    let str = "";
    error.error ? str += error.error.toString() : str;
    (error.parameters && error.parameters.reason) ? str += " " + error.parameters.reason.toString() : str;
    return str;
}

/**
 * Do a varlink call on a new channel. This is more expensive than
 * `varlinkCallChannel()` but allows multiple parallel calls.
 */
export function varlinkCall(channelOptions, method, parameters) {
    var channel = cockpit.channel(Object.assign({payload: "stream", binary: true, superuser: "require"}, channelOptions));

    return varlinkCallChannel(channel, method, parameters).finally(() => {
        channel.close();
    });
}

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
    return _(cpuPercent + "%");
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

// TODO
export function container_stop(container, timeout) {
}

export function updateContainers() {
    let newContainers = [];
    let newContainersStats = [];
    return new Promise((resolve, reject) => {
        varlinkCall(PODMAN, "io.podman.ListContainers")
                .then(reply => {
                    let newContainersMeta = reply.containers;
                    if (!newContainersMeta) {
                        resolve({newContainers: newContainers, newContainersStats: newContainersStats});
                        return;
                    }
                    const containerCount = newContainersMeta.length;
                    let inspectRet = [];
                    newContainersMeta.map((container) => {
                        let proEle = new Promise((resolve, reject) => {
                            varlinkCall(PODMAN, "io.podman.InspectContainer", {name: container.id})
                                    .then(reply => {
                                        resolve(JSON.parse(reply.container));
                                    })
                                    .catch(ex => {
                                        reject(new Error("Failed to do InspectContainer call:", ex, JSON.stringify(ex)));
                                    });
                        });
                        inspectRet.push(proEle);
                    });
                    Promise.all(inspectRet)
                            .then((inspectRet) => {
                                let runEle = newContainersMeta.filter((ele) => {
                                    return ele.status === "running";
                                });
                                inspectRet.map((inspectRet) => {
                                    newContainers[inspectRet.ID] = inspectRet;
                                    if (runEle.length === 0 && Object.keys(newContainers).length === containerCount) {
                                        resolve({newContainers: newContainers, newContainersStats: newContainersStats});
                                    }
                                });
                            })
                            .catch(ex => {
                                console.error("Failed to do InspectContainer call:", ex, JSON.stringify(ex));
                            });
                    let containerStatsRet = [];
                    let runCtrArr = newContainersMeta.filter((ele) => {
                        return ele.status === "running";
                    }).map((container) => {
                        let proEle = new Promise((resolve, reject) => {
                            varlinkCall(PODMAN, "io.podman.GetContainerStats", {name: container.id})
                                    .then(reply => {
                                        resolve({ctrId: container.id, ctrStats:reply.container});
                                    })
                                    .catch(ex => {
                                        console.error("Failed to do GetContainerStats call:", ex, JSON.stringify(ex));
                                        reject(new Error("Failed to do GetContainerStats call:", ex, JSON.stringify(ex)));
                                    });
                        });
                        containerStatsRet.push(proEle);
                    });

                    Promise.all(containerStatsRet)
                            .then((containerStatsRet) => {
                                containerStatsRet.map((containerStatsRet) => {
                                    newContainersStats[containerStatsRet.ctrId] = containerStatsRet.ctrStats;
                                    if (newContainers.length === containerCount && Object.keys(newContainersStats).length === runCtrArr.length) {
                                        resolve({newContainers: newContainers, newContainersStats: newContainersStats});
                                    }
                                });
                            })
                            .catch(ex => console.error("Failed to do GetContainerStats call:", ex, JSON.stringify(ex)));
                })
                .catch(ex => {
                    console.error("Failed to do ListContainers call:", JSON.stringify(ex), ex.toString());
                    reject(new Error("Failed to do ListContainers call"));
                });
    });
}

export function updateImages() {
    let newImages = [];
    let newImagesMeta = [];
    return new Promise((resolve, reject) => {
        varlinkCall(PODMAN, "io.podman.ListImages")
                .then(reply => {
                    newImagesMeta = reply.images;
                    const imageCount = newImagesMeta ? newImagesMeta.length : 0;
                    if (!newImagesMeta) {
                        resolve(newImages);
                        return;
                    }
                    let inspectRet = [];
                    newImagesMeta.map((img) => {
                        let proEle = new Promise((resolve, reject) => {
                            varlinkCall(PODMAN, "io.podman.InspectImage", {name: img.id})
                                    .then(reply => {
                                        resolve(JSON.parse(reply.image));
                                    })
                                    .catch(ex => {
                                        reject(new Error("Failed to do InspectImage call:", ex, JSON.stringify(ex)));
                                    });
                        });
                        inspectRet.push(proEle);
                    });
                    Promise.all(inspectRet)
                            .then((inspectRet) => {
                                inspectRet.map((inspectRet) => {
                                    newImages[inspectRet.Id] = inspectRet;
                                    if (Object.keys(newImages).length === imageCount) {
                                        resolve(newImages);
                                    }
                                });
                            })
                            .catch(ex => {
                                console.error("Failed to do InspectImage call:", ex, JSON.stringify(ex));
                            });
                })
                .catch(ex => {
                    console.error("Failed to do ListImages call:", ex, JSON.stringify(ex));
                    reject(new Error("Failed to do ListImages call"));
                });
    });
}
