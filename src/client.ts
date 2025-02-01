// @cockpit-ts-relaxed
import type { JsonObject, JsonValue } from "cockpit";

import rest from './rest.ts';
import type { MonitorCallbackJson } from './rest.ts';

const PODMAN_SYSTEM_ADDRESS = "/run/podman/podman.sock";
export const VERSION = "/v1.12/";

export function getAddress(system: boolean): string {
    if (system)
        return PODMAN_SYSTEM_ADDRESS;
    const xrd = sessionStorage.getItem('XDG_RUNTIME_DIR');
    if (xrd)
        return (xrd + "/podman/podman.sock");
    console.warn("$XDG_RUNTIME_DIR is not present. Cannot use user service.");
    return "";
}

function podmanCall(name: string, method: string, args: JsonObject, system: boolean, body?: string): Promise<string> {
    const options = {
        method,
        path: VERSION + name,
        body: body || "",
        params: args,
    };

    return rest.call(getAddress(system), system, options);
}

const podmanJson = (
    name: string, method: string, args: JsonObject, system: boolean, body?: string
): Promise<JsonObject|JsonValue> => (
    podmanCall(name, method, args, system, body)
            .then(reply => JSON.parse(reply))
);

function podmanMonitor(name: string, method: string, args: JsonObject, callback: MonitorCallbackJson, system: boolean): Promise<void> {
    const options = {
        method,
        path: VERSION + name,
        body: "",
        params: args,
    };

    const connection = rest.connect(getAddress(system), system);
    return connection.monitor(options, callback, system);
}

export const streamEvents = (system: boolean, callback: MonitorCallbackJson) => podmanMonitor("libpod/events", "GET", {}, callback, system);

export function getInfo(system: boolean): Promise<JsonObject> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("timeout")), 5000);
        podmanJson("libpod/info", "GET", {}, system)
                .then(reply => resolve(reply as JsonObject)) // podman API, we know it's an object
                .catch(reject)
                .finally(() => clearTimeout(timeout));
    });
}

export const getContainers = (system: boolean) => podmanJson("libpod/containers/json", "GET", { all: true }, system);

export const streamContainerStats = (system: boolean, callback: MonitorCallbackJson) =>
    podmanMonitor("libpod/containers/stats", "GET", { stream: true }, callback, system);

export function inspectContainer(system: boolean, id: string): Promise<JsonObject> {
    const options = {
        size: false // set true to display filesystem usage
    };
    return podmanJson("libpod/containers/" + id + "/json", "GET", options, system) as Promise<JsonObject>;
}

export const delContainer = (system: boolean, id: string, force: boolean) =>
    podmanCall("libpod/containers/" + id, "DELETE", { force }, system);

export const renameContainer = (system: boolean, id: string, config: JsonObject) =>
    podmanCall("libpod/containers/" + id + "/rename", "POST", config, system);

export const createContainer = (system: boolean, config: JsonObject) =>
    podmanJson("libpod/containers/create", "POST", {}, system, JSON.stringify(config));

export const commitContainer = (system: boolean, commitData: JsonObject) =>
    podmanCall("libpod/commit", "POST", commitData, system);

export const postContainer = (system: boolean, action: string, id: string, args: JsonObject) =>
    podmanCall("libpod/containers/" + id + "/" + action, "POST", args, system);

export const runHealthcheck = (system: boolean, id: string) =>
    podmanCall("libpod/containers/" + id + "/healthcheck", "GET", {}, system);

export const postPod = (system: boolean, action: string, id: string, args: JsonObject) =>
    podmanCall("libpod/pods/" + id + "/" + action, "POST", args, system);

export const delPod = (system: boolean, id: string, force: boolean) =>
    podmanCall("libpod/pods/" + id, "DELETE", { force }, system);

export const createPod = (system: boolean, config: JsonObject) =>
    podmanCall("libpod/pods/create", "POST", {}, system, JSON.stringify(config));

export function execContainer(system: boolean, id: string): Promise<JsonObject> {
    const args = {
        AttachStderr: true,
        AttachStdout: true,
        AttachStdin: true,
        Tty: true,
        Cmd: ["/bin/sh"],
    };

    return podmanJson("libpod/containers/" + id + "/exec", "POST", {}, system, JSON.stringify(args)) as Promise<JsonObject>;
}

export function resizeContainersTTY(system: boolean, id: string, exec: boolean, width: number, height: number): Promise<string> {
    const args = {
        h: height,
        w: width,
    };

    let point = "containers/";
    if (!exec)
        point = "exec/";

    return podmanCall("libpod/" + point + id + "/resize", "POST", args, system);
}

// https://docs.podman.io/en/stable/_static/api.html#tag/images/operation/ImageInspectLibpod
export type ContainerImage = {
    isSystem: boolean,

    // fields from images/json API (not exhaustive)
    Containers: number,
    Created: number,
    Labels: string[] | null,
    RepoTags: string[],
    Size: number,

    // fields from libpod/images/id/json
    Id: string,
    Author: string,
    Entrypoint: string[],
    Command: string[],
    Name: string | null,
    Ports: string[],
    Env: string[],
}

function parseImageInfo(listInfos: Record<string, JsonObject>, imageInfo: JsonObject, isSystem: boolean): ContainerImage {
    const c = imageInfo.Config as JsonObject;
    const Id = imageInfo.Id as string;
    const listInfo = listInfos[Id];

    return {
        isSystem,

        Containers: listInfo.Containers as number,
        Created: listInfo.Created as number,
        Labels: c.Labels as string[] ?? null,
        Name: c.Name as string ?? "<none>:<none>",
        RepoTags: imageInfo.RepoTags as string[] ?? [],
        Size: imageInfo.Size as number,

        Id,
        Author: imageInfo.Author as string,
        Entrypoint: c.Entrypoint as string[],
        Command: c.Cmd as string[],
        Ports: Object.keys(c.ExposedPorts ?? {}),
        Env: c.Env as string[] || [],
    };
}

export function getImages(system: boolean, id?: string): Promise<Record<string, ContainerImage>> {
    const options = id ? { filters: JSON.stringify({ id: [id] }) } : {};

    return podmanJson("libpod/images/json", "GET", options, system)
            .then(reply => {
                const promises = [];

                const listInfo: Record<string, JsonObject> = {};
                for (const image of (reply as JsonObject[])) {
                    listInfo[image.Id as string] = image;
                    promises.push(podmanJson("libpod/images/" + (image.Id as string) + "/json", "GET", {}, system));
                }

                const images: Record<string, ContainerImage> = {};

                return Promise.all(promises)
                        .then(replies => {
                            for (const info of replies) {
                                const image = parseImageInfo(listInfo, info as JsonObject, system);
                                images[image.Id] = image;
                            }
                            return images;
                        });
            });
}

export function getPods(system: boolean, id: string): Promise<JsonObject[]> {
    const options = id ? { filters: JSON.stringify({ id: [id] }) } : {};
    return podmanJson("libpod/pods/json", "GET", options, system) as Promise<JsonObject[]>;
}

export const delImage = (system: boolean, id: string, force: string) =>
    podmanJson("libpod/images/" + id, "DELETE", { force }, system);

export const untagImage = (system: boolean, id: string, repo: string, tag: string) =>
    podmanCall("libpod/images/" + id + "/untag", "POST", { repo, tag }, system);

export function pullImage(system: boolean, reference: string): Promise<void> {
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

export const pruneUnusedImages = (system: boolean) =>
    podmanJson("libpod/images/prune?all=true", "POST", {}, system);

export const imageHistory = (system: boolean, id: string) =>
    podmanJson(`libpod/images/${id}/history`, "GET", {}, system);

export const imageExists = (system: boolean, id: string) =>
    podmanCall("libpod/images/" + id + "/exists", "GET", {}, system);

export const containerExists = (system: boolean, id: string) =>
    podmanCall("libpod/containers/" + id + "/exists", "GET", {}, system);
