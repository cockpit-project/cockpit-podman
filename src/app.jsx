/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Copyright (C) 2017 Red Hat, Inc.
 */

import React from 'react';

import { Alert, AlertActionCloseButton, AlertGroup } from "@patternfly/react-core/dist/esm/components/Alert";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { EmptyState, EmptyStateFooter, EmptyStateActions, EmptyStateVariant } from "@patternfly/react-core/dist/esm/components/EmptyState";
import { Page, PageSection, } from "@patternfly/react-core/dist/esm/components/Page";
import { Stack } from "@patternfly/react-core/dist/esm/layouts/Stack";
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { WithDialogs } from "dialogs.jsx";

import cockpit from 'cockpit';
import { basename } from "cockpit-path";
import * as python from "python";
import { superuser } from "superuser";

import ContainerHeader from './ContainerHeader.jsx';
import Containers from './Containers.jsx';
import Images from './Images.jsx';
import * as client from './client.js';
import detect_quadlets from './detect-quadlets.py';
import rest from './rest.js';
import { makeKey, WithPodmanInfo, debug } from './util.js';

const _ = cockpit.gettext;

// sort order of "users" state for dialogs: system, session user, then other users by ascending name
function compareUser(a, b) {
    if (a.uid === 0)
        return -1;
    if (b.uid === 0)
        return 1;
    if (a.uid === null)
        return -1;
    if (b.uid === null)
        return 1;
    return a.name.localeCompare(b.name);
}

class Application extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            // currently connected services per user: { con, uid, name, dbus: { client, subscription }, imagesLoaded, containersLoaded, podsLoaded, quadletsLoaded }
            // start with dummy state to wait for initialization
            users: [{ con: null, uid: 0, name: _("system"), dbus: null }, { con: null, uid: null, name: _("user"), dbus: null }],
            images: null,
            containers: null,
            containersFilter: "all",
            containersStats: {},
            // Mapping of quadlet containers and pods on the system to show
            // inactive containers and pods as quadlets are ephemeral and the
            // container/pod is not kept around when they are stopped.
            // { "$uid-$name.service": { source_path, name, exec, image, pod  } }
            quadletContainers: {},
            // { "$uid-$name-pod.service": { source_path, name } }
            quadletPods: {},
            textFilter: "",
            ownerFilter: "all",
            dropDownValue: 'Everything',
            notifications: [],
            version: '1.3.0',
            selinuxAvailable: false,
            userPodmanRestartAvailable: false,
            userLingeringEnabled: null,
            location: {},
        };
        this.onAddNotification = this.onAddNotification.bind(this);
        this.onDismissNotification = this.onDismissNotification.bind(this);
        this.onFilterChanged = this.onFilterChanged.bind(this);
        this.onOwnerChanged = this.onOwnerChanged.bind(this);
        this.onContainerFilterChanged = this.onContainerFilterChanged.bind(this);
        this.updateContainer = this.updateContainer.bind(this);
        this.goToServicePage = this.goToServicePage.bind(this);
        this.onNavigate = this.onNavigate.bind(this);

        this.pendingUpdateContainer = {}; // key (uid-id) → promise
    }

    onAddNotification(notification) {
        notification.index = this.state.notifications.length;

        this.setState(prevState => ({
            notifications: [
                ...prevState.notifications,
                notification
            ]
        }));
    }

    onDismissNotification(notificationIndex) {
        const notificationsArray = this.state.notifications.concat();
        const index = notificationsArray.findIndex(current => current.index == notificationIndex);

        if (index !== -1) {
            notificationsArray.splice(index, 1);
            this.setState({ notifications: notificationsArray });
        }
    }

    updateUrl(options) {
        cockpit.location.go([], options);
    }

    onFilterChanged(value) {
        this.setState({
            textFilter: value
        });

        const options = { ...this.state.location };
        if (value === "")
            delete options.name;
        else
            options.name = value;
        this.updateUrl(options);
    }

    onOwnerChanged(value) {
        this.setState({
            ownerFilter: value
        });

        const options = { ...this.state.location };
        if (value == "all")
            delete options.owner;
        else
            options.owner = value.toString();
        this.updateUrl(options);
    }

    onContainerFilterChanged(value) {
        this.setState({
            containersFilter: value
        });

        const options = { ...this.state.location };
        if (value == "running")
            delete options.container;
        else
            options.container = value;
        this.updateUrl(options);
    }

    updateState(state, key, newValue) {
        this.setState(prevState => {
            return {
                [state]: { ...prevState[state], [key]: newValue }
            };
        });
    }

    updateContainerStats(con) {
        client.streamContainerStats(con, reply => {
            if (reply.Error != null) // executed when container stop
                console.warn("Failed to update container stats:", JSON.stringify(reply.message));
            else {
                reply.Stats.forEach(stat => this.updateState("containersStats", makeKey(con.uid, stat.ContainerID), stat));
            }
        }).catch(ex => {
            if (ex.cause == "no support for CGroups V1 in rootless environments" || ex.cause == "Container stats resource only available for cgroup v2") {
                console.log("This OS does not support CgroupsV2. Some information may be missing.");
            } else
                console.warn("Failed to update container stats:", JSON.stringify(ex.message));
        });
    }

    initContainers(con) {
        return client.getContainers(con)
                .then(containerList => Promise.all(
                    containerList.map(container => client.inspectContainer(con, container.Id))
                ))
                .then(containerDetails => {
                    this.setState(prevState => {
                        // keep/copy the containers of other users
                        const copyContainers = {};
                        Object.entries(prevState.containers || {}).forEach(([id, container]) => {
                            if (container.uid !== con.uid)
                                copyContainers[id] = container;
                        });
                        for (const detail of containerDetails) {
                            detail.uid = con.uid;
                            detail.key = makeKey(con.uid, detail.Id);
                            copyContainers[detail.key] = detail;
                        }

                        const users = prevState.users.map(u => u.uid === con.uid ? { ...u, containersLoaded: true } : u);
                        return { containers: copyContainers, users };
                    });
                    this.updateContainerStats(con);
                })
                .catch(e => console.warn("initContainers uid", con.uid, "getContainers failed:", e.toString()));
    }

    updateImages(con) {
        client.getImages(con)
                .then(reply => {
                    this.setState(prevState => {
                        // Copy only images that could not be deleted with this event
                        // So when event from one uid comes, only copy the other images
                        const copyImages = {};
                        Object.entries(prevState.images || {}).forEach(([Id, image]) => {
                            if (image.uid !== con.uid)
                                copyImages[Id] = image;
                        });
                        Object.entries(reply).forEach(([Id, image]) => {
                            image.uid = con.uid;
                            image.key = makeKey(con.uid, Id);
                            copyImages[image.key] = image;
                        });

                        const users = prevState.users.map(u => u.uid === con.uid ? { ...u, imagesLoaded: true } : u);
                        return { images: copyImages, users };
                    });
                })
                .catch(ex => {
                    console.warn("Failed to do updateImages for uid", con.uid, ":", JSON.stringify(ex));
                });
    }

    updatePods(con) {
        return client.getPods(con)
                .then(reply => {
                    this.setState(prevState => {
                        // Copy only pods that could not be deleted with this event
                        // So when event from one uid comes, only copy the other pods
                        const copyPods = {};
                        Object.entries(prevState.pods || {}).forEach(([id, pod]) => {
                            if (pod.uid !== con.uid)
                                copyPods[id] = pod;
                        });
                        for (const pod of reply || []) {
                            pod.uid = con.uid;
                            pod.key = makeKey(con.uid, pod.Id);
                            copyPods[pod.key] = pod;
                        }

                        const users = prevState.users.map(u => u.uid === con.uid ? { ...u, podsLoaded: true } : u);
                        return { pods: copyPods, users };
                    });
                })
                .catch(ex => {
                    console.warn("Failed to do updatePods for uid", con.uid, ":", JSON.stringify(ex));
                });
    }

    updateContainer(con, id, event) {
        /* when firing off multiple calls in parallel, podman can return them in a random order.
         * This messes up the state. So we need to serialize them for a particular container. */
        const key = makeKey(con.uid, id);
        const wait = this.pendingUpdateContainer[key] ?? Promise.resolve();

        const new_wait = wait.then(() => client.inspectContainer(con, id))
                .then(details => {
                    details.uid = con.uid;
                    details.key = key;
                    // HACK: during restart State never changes from "running"
                    //       override it to reconnect console after restart
                    if (event?.Action === "restart")
                        details.State.Status = "restarting";
                    this.updateState("containers", key, details);
                })
                .catch(e => console.warn("updateContainer uid", con.uid, "inspectContainer failed:", e.toString()));
        this.pendingUpdateContainer[key] = new_wait;
        new_wait.finally(() => { delete this.pendingUpdateContainer[key] });

        return new_wait;
    }

    updateImage(con, id) {
        client.getImages(con, id)
                .then(reply => {
                    const image = reply[id];
                    image.uid = con.uid;
                    image.key = makeKey(con.uid, id);
                    this.updateState("images", image.key, image);
                })
                .catch(ex => {
                    console.warn("Failed to do updateImage for uid", con.uid, ":", JSON.stringify(ex));
                });
    }

    updatePod(con, id) {
        return client.getPods(con, id)
                .then(reply => {
                    if (reply && reply.length > 0) {
                        const pod = reply[0];

                        pod.uid = con.uid;
                        pod.key = makeKey(con.uid, id);
                        this.updateState("pods", pod.key, pod);
                    }
                })
                .catch(ex => {
                    console.warn("Failed to do updatePod for uid", con.uid, ":", JSON.stringify(ex));
                });
    }

    // see https://docs.podman.io/en/latest/markdown/podman-events.1.html

    handleImageEvent(event, con) {
        switch (event.Action) {
        case 'push':
        case 'save':
        case 'tag':
            this.updateImage(con, event.Actor.ID);
            break;
        case 'pull': // Pull event has not event.id
        case 'untag':
        case 'remove':
        case 'prune':
        case 'build':
            this.updateImages(con);
            break;
        default:
            console.warn('Unhandled event type ', event.Type, event.Action);
        }
    }

    handleContainerEvent(event, con) {
        const id = event.Actor.ID;

        switch (event.Action) {
        /* The following events do not need to trigger any state updates */
        case 'attach':
        case 'exec':
        case 'export':
        case 'import':
        case 'init':
        case 'kill':
        case 'mount':
        case 'prune':
        case 'restart':
        case 'sync':
        case 'unmount':
        case 'wait':
            break;
        /* The following events need only to update the Container list
         * We do get the container affected in the event object but for
         * now we 'll do a batch update
         */
        case 'start':
            // HACK: We don't get 'started' event for pods got started by the first container which was added to them
            // https://github.com/containers/podman/issues/7213
            (event.Actor.Attributes.podId
                ? this.updatePod(con, event.Actor.Attributes.podId)
                : this.updatePods(con)
            ).then(() => this.updateContainer(con, id, event));
            break;
        case 'checkpoint':
        case 'cleanup':
        case 'create':
        case 'died':
        case 'exec_died': // HACK: pick up health check runs with older podman versions, see https://github.com/containers/podman/issues/19237
        case 'health_status':
        case 'pause':
        case 'restore':
        case 'stop':
        case 'unpause':
        case 'rename': // rename event is available starting podman v4.1; until then the container does not get refreshed after renaming
            this.updateContainer(con, id, event);
            break;

        case 'remove':
            this.setState(prevState => {
                const containers = { ...prevState.containers };
                delete containers[makeKey(con.uid, id)];
                let pods;

                if (event.Actor.Attributes.podId) {
                    const podKey = makeKey(con.uid, event.Actor.Attributes.podId);
                    const newPod = { ...prevState.pods[podKey] };
                    newPod.Containers = newPod.Containers.filter(container => container.Id !== id);
                    pods = { ...prevState.pods, [podKey]: newPod };
                } else {
                    // HACK: with podman < 4.3.0 we don't get a pod event when a container in a pod is removed
                    // https://github.com/containers/podman/issues/15408
                    pods = prevState.pods;
                    this.updatePods(con);
                }

                return { containers, pods };
            });
            break;

        // only needs to update the Image list, this ought to be an image event
        case 'commit':
            this.updateImages(con);
            break;
        default:
            console.warn('Unhandled event type ', event.Type, event.Action);
        }
    }

    handlePodEvent(event, con) {
        switch (event.Action) {
        case 'create':
        case 'kill':
        case 'pause':
        case 'start':
        case 'stop':
        case 'unpause':
            this.updatePod(con, event.Actor.ID);
            break;
        case 'remove':
            this.setState(prevState => {
                const pods = { ...prevState.pods };
                delete pods[makeKey(con.uid, event.Actor.ID)];
                return { pods };
            });
            break;
        default:
            console.warn('Unhandled event type ', event.Type, event.Action);
        }
    }

    handleEvent(event, con) {
        switch (event.Type) {
        case 'container':
            this.handleContainerEvent(event, con);
            break;
        case 'image':
            this.handleImageEvent(event, con);
            break;
        case 'pod':
            this.handlePodEvent(event, con);
            break;
        default:
            console.warn('Unhandled event type ', event.Type);
        }
    }

    cleanupAfterService(con) {
        debug("cleanupAfterService", con.uid, "current owner filter:", this.state.ownerFilter);
        ["images", "containers", "pods"].forEach(t => {
            if (this.state[t])
                this.setState(prevState => {
                    const copy = {};
                    Object.entries(prevState[t] || {}).forEach(([id, v]) => {
                        if (v.uid !== con.uid)
                            copy[id] = v;
                    });
                    return { [t]: copy };
                });
        });

        // keep dummy (null) connections from other users, only remove valid ones
        this.setState(prevState => ({ users: prevState.users.filter(u => u.con === null || u.uid !== con.uid) }));

        // reset owner filter if the current filter is the closed connection
        if (con.uid == this.state.ownerFilter)
            this.onOwnerChanged("all");
    }

    // Read information about quadlets from /run/ until podman provides a remote API for this.
    // https://github.com/containers/podman/issues/27119
    // Required for cockpit-podman to show inactive quadlets which have no
    // stopped container/pod associated with them as they are ephemeral.
    // The state object of the container or pod has just enough properties to mock a real inactive container or pod.
    async initQuadlets(con) {
        let path = "/run/systemd/generator";
        let quadlets = { pods: {}, containers: {} };

        if (con.uid === null) {
            path = sessionStorage.getItem('XDG_RUNTIME_DIR') + '/systemd/generator';
        } else if (con.uid !== 0) {
            // TODO: support loading other users quadlets
            debug(`unsupported connection ${con.uid} for loading quadlets`);
            this.setState(prevState => {
                const users = prevState.users.map(u => u.uid === con.uid ? { ...u, quadletsLoaded: true } : u);
                return { users };
            });
            return;
        }

        try {
            const quadlets_str = await python.spawn(detect_quadlets, [path]);
            quadlets = JSON.parse(quadlets_str);
        } catch (exc) {
            console.warn(`error during discovering of quadlets for ${con.uid}`, exc);
            this.setState(prevState => {
                const users = prevState.users.map(u => u.uid === con.uid ? { ...u, quadletsLoaded: true } : u);
                return { users };
            });
            return;
        }

        // { id-service_name: { } }
        this.setState(prevState => {
            const podNameServiceMap = {};

            const copyQuadletPods = {};
            // keep/copy the pods of other users
            Object.entries(prevState.quadletPods || {}).forEach(([id, container]) => {
                if (container.uid !== con.uid)
                    copyQuadletPods[id] = container;
            });

            for (const key of Object.keys(quadlets.pods)) {
                const quadlet_pod = quadlets.pods[key];
                const container_key = makeKey(con.uid, key);

                const pod = {
                    uid: con.uid,
                    key: container_key,
                    Id: container_key,
                    Status: "Exited",
                    Name: quadlet_pod.name,
                    Labels: {
                        PODMAN_SYSTEMD_UNIT: key,
                    }
                };
                copyQuadletPods[pod.key] = pod;

                // The key is the service name, but that isn't used in reference
                podNameServiceMap[basename(quadlet_pod.source_path)] = key;
            }

            const copyQuadletContainers = {};
            // keep/copy the containers of other users
            Object.entries(prevState.quadletContainers || {}).forEach(([id, container]) => {
                if (container.uid !== con.uid)
                    copyQuadletContainers[id] = container;
            });

            for (const key of Object.keys(quadlets.containers)) {
                const quadlet = quadlets.containers[key];
                const container_key = makeKey(con.uid, key);

                // Mock podman container state
                const container = {
                    uid: con.uid,
                    key: container_key,
                    Id: key,
                    IsService: false,
                    IsInfra: false,
                    Name: quadlet.name,
                    ImageName: quadlet.image,
                    NetworkSettings: {
                        Ports: [],
                    },
                    Mounts: [],
                    Config: {
                        Labels: {
                            PODMAN_SYSTEMD_UNIT: key,
                        },
                    },
                    State: {
                        Status: 'exited'
                    }
                };

                const found_pod = podNameServiceMap[quadlet.pod];
                if (found_pod) {
                    container.Pod = found_pod;
                }
                copyQuadletContainers[container.key] = container;
            }

            const users = prevState.users.map(u => u.uid === con.uid ? { ...u, quadletsLoaded: true } : u);
            return { quadletContainers: copyQuadletContainers, quadletPods: copyQuadletPods, users };
        });
    }

    async subscribeDaemonReload(con) {
        // We don't support subscribing on reload events for "other" users.
        if (con.uid !== 0 && con.uid !== null) {
            return;
        }

        debug('subscribe daemon reload', con);

        const options = con.uid === 0 ? { bus: "system", superuser: "try" } : { bus: "session" };
        const subscribe = (client) => {
            const subscription = client.subscribe({ interface: "org.freedesktop.systemd1.Manager", member: "Reloading" }, (_path, _iface, _signal, [reloading]) => {
                if (!reloading)
                    this.initQuadlets(con);
            });

            this.setState(prevState => {
                const users = prevState.users.map(u => u.uid === con.uid ? { ...u, dbus: { client, subscription } } : u);
                return { users };
            });
        };

        let client = null;
        const user = this.state.users.find(u => u.uid === con.uid);

        // don't add multiple Reload subscriptions
        if (user?.dbus?.subscription) {
            return;
        }

        if (user?.dbus) {
            client = user.dbus.client;
        } else {
            client = cockpit.dbus("org.freedesktop.systemd1", options);
        }

        client.call("/org/freedesktop/systemd1", "org.freedesktop.systemd1.Manager", "Subscribe", []).then(() => {
            subscribe(client);
        })
                .catch(err => {
                    if (err.name === "org.freedesktop.systemd1.AlreadySubscribed") {
                        subscribe(client);
                    } else {
                        client.close();
                        console.error(`Cannot subscribe systemd reload event for ${con.uid}`);
                    }
                });
    }

    async init(uid, username) {
        debug("init uid", uid, "name", username);
        const system = uid === 0;
        const is_other_user = (uid !== 0 && uid !== null);

        let con = null;

        try {
            const start_args = [
                ...(is_other_user ? ["runuser", "-u", username, "--"] : []),
                "systemctl",
                ...(system ? [] : ["--user"]),
                "start", "podman.socket"
            ];
            const environ = is_other_user ? ["XDG_RUNTIME_DIR=/run/user/" + uid] : [];
            await cockpit.spawn(start_args, { superuser: uid === null ? null : "require", err: "message", environ });
            con = rest.connect(uid);
            const reply = await client.getInfo(con);
            this.setState(prevState => {
                const users = prevState.users.filter(u => u.uid !== uid);
                users.push({ con, uid, name: username, containersLoaded: false, podsLoaded: false, imagesLoaded: false, quadletsLoaded: false });
                // keep a nice sort order for dialogs
                users.sort(compareUser);
                debug("init uid", uid, "username", username, "new users:", users);
                return {
                    users,
                    version: reply.version.Version,
                    registries: reply.registries,
                    cgroupVersion: reply.host.cgroupVersion,
                };
            });
        } catch (err) {
            if (!system || err.problem != 'access-denied')
                console.warn("init uid", uid, "getInfo failed:", err.toString());

            this.setState(prevState => ({ users: prevState.users.filter(u => u.uid !== uid) }));
            return;
        }

        this.updateImages(con);
        this.initContainers(con);
        this.initQuadlets(con);
        this.subscribeDaemonReload(con);
        this.updatePods(con);

        client.streamEvents(con, message => this.handleEvent(message, con))
                .catch(e => console.error("uid", uid, "streamEvents failed:", JSON.stringify(e)))
                .finally(() => {
                    console.log("uid", uid, "podman service closed");
                    this.cleanupAfterService(con);
                    const user = this.state.users.find(u => u.uid === uid);
                    if (user?.dbus) {
                        user.dbus?.subscription?.remove();
                        user.dbus?.client?.close();
                    }
                });
    }

    componentDidMount() {
        superuser.addEventListener("changed", () => this.init(0, _("system")));

        cockpit.user().then(user => {
            // there is no "user service" for root, ignore that
            if (user.id === 0) {
                // clear the dummy init user, otherwise UI waits forever for initialization
                this.setState(prevState => ({ users: prevState.users.filter(u => u.uid !== null) }));
                return;
            }

            cockpit.script("echo $XDG_RUNTIME_DIR")
                    .then(xrd => {
                        sessionStorage.setItem('XDG_RUNTIME_DIR', xrd.trim());
                        this.init(null, user.name || _("User"));
                        this.checkUserRestartService();
                    })
                    .catch(e => console.log("Could not read $XDG_RUNTIME_DIR:", e.message));

            // HACK: https://github.com/systemd/systemd/issues/22244#issuecomment-1210357701
            cockpit.file(`/var/lib/systemd/linger/${user.name}`).watch((content, tag) => {
                if (content == null && tag === '-') {
                    this.setState({ userLingeringEnabled: false });
                } else {
                    this.setState({ userLingeringEnabled: true });
                }
            });

            // detect which other users have containers running
            cockpit.spawn([
                'find', '/sys/fs/cgroup',
                // RHEL 8 version still calls it "podman-*.scope", newer ones "libpod*"
                '(', '-name', 'libpod.*scope', '-o', '-name', 'podman-*.scope',
                '-o', '-name', 'libpod-payload*', ')',
                '-exec', 'stat', '--format=%u %U', '{}', ';'],
                          // this find command doesn't need root, but user switching does;
                          // hence skip the whole detection for unpriv sessions
                          { superuser: "require", error: "message" })
                    .then(output => {
                        const other_users = [];
                        const trimmed = output.trim();
                        if (!trimmed)
                            return;

                        trimmed.split('\n').forEach(line => {
                            const [uid_str, username] = line.split(' ');
                            const uid = parseInt(uid_str);
                            if (isNaN(uid)) {
                                console.error(`User container detection: invalid uid '${uid_str}' in output '${output}'`); // not-covered: Should Not Happen™
                                return; // not-covered: ditto
                            }
                            // ignore standard users
                            if (uid === 0 || uid === user.id)
                                return;
                            if (!other_users.find(u => u.uid === uid))
                                other_users.push({ uid, name: username, con: null });
                        });
                        debug("other users who have containers running:", JSON.stringify(other_users));
                        this.setState(prevState => ({ users: prevState.users.concat(other_users) }));
                    })
                    .catch(ex => {
                        if (ex.problem == 'access-denied')
                            debug("unprivileged session, skipping detection of other users");
                        else
                            console.warn("failed to detect other users:", ex);
                    });
        });

        cockpit.spawn("selinuxenabled", { error: "ignore" })
                .then(() => this.setState({ selinuxAvailable: true }))
                .catch(() => this.setState({ selinuxAvailable: false }));

        cockpit.addEventListener("locationchanged", this.onNavigate);
        this.onNavigate();
    }

    componentWillUnmount() {
        cockpit.removeEventListener("locationchanged", this.onNavigate);

        // Cleanup DBus subscriptions
        this.state.users.forEach(user => {
            if (user?.dbus) {
                user.dbus?.subscription?.remove();
                user.dbus?.client?.close();
            }
        });
    }

    onNavigate() {
        // HACK: Use usePageLocation when this is rewritten into a functional component
        const { options, path } = cockpit.location;
        this.setState({ location: options }, () => {
            // only use the root path
            if (path.length === 0) {
                if (options.name) {
                    this.onFilterChanged(options.name);
                }
                if (options.container) {
                    this.onContainerFilterChanged(options.container);
                }
                if (["all", undefined].includes(options.owner)) {
                    // disconnect all non-standard users
                    this.setState(prevState => ({
                        users: prevState.users.map(u => {
                            if (u.uid !== 0 && u.uid !== null && u.con) {
                                debug("onNavigate All: closing unused connection to", u.name);
                                u.con.close();
                                return { uid: u.uid, name: u.name, con: null };
                            } else
                                return u;
                        }),
                        ownerFilter: "all",
                    }));
                } else {
                    const uid = options.owner === "user" ? null : parseInt(options.owner);
                    const user = this.state.users.find(u => u.uid === uid);
                    if (user) {
                        // disconnect other non-standard users, to avoid piling up connections
                        this.setState(prevState => ({
                            users: prevState.users.map(u => {
                                if (u.uid !== uid && u.uid !== 0 && u.uid !== null && u.con) {
                                    debug("onNavigate", user.name, ": closing unused connection to", u.name);
                                    u.con.close();
                                    return { uid: u.uid, name: u.name, con: null };
                                } else
                                    return u;
                            }),
                            ownerFilter: uid === null ? "user" : uid,
                        }), () => {
                            if (user.con === null) {
                                debug("onNavigate", user.name, ": initializing connection");
                                this.init(user.uid, user.name);
                            } else {
                                debug("onNavigate", user.name, ": connection already initialized");
                            }
                        });
                    } else {
                        console.warn("Unknown user", options.owner, "in URL, ignoring");
                        debug("known users:", JSON.stringify(this.state.users.map(u => [u.name, u.uid])));
                        // reset URL to current value
                        this.updateUrl({ ...this.state.location, owner: this.state.ownerFilter });
                    }
                }
            }
        });
    }

    async checkUserRestartService() {
        const out = await cockpit.spawn(
            ["systemctl", "--user", "show", "--value", "-p", "LoadState", "podman-restart"],
            { environ: ["LC_ALL=C"], error: "ignore" });
        this.setState({ userPodmanRestartAvailable: out.trim() === "loaded" });
    }

    goToServicePage(e) {
        if (!e || e.button !== 0)
            return;
        cockpit.jump("/system/services#/podman.socket");
    }

    render() {
        // show troubleshoot if no users are available, i.e. all user's podman services failed
        if (this.state.users.length === 0) {
            return (
                <Page className="pf-m-no-sidebar">
                    <PageSection hasBodyWrapper={false}>
                        <EmptyState headingLevel="h2" icon={ExclamationCircleIcon} titleText={_("Podman service failed")} variant={EmptyStateVariant.full}>
                            <EmptyStateFooter>
                                <EmptyStateActions>
                                    <Button variant="primary" onClick={this.goToServicePage}>
                                        {_("Troubleshoot")}
                                    </Button>
                                </EmptyStateActions>
                            </EmptyStateFooter>
                        </EmptyState>
                    </PageSection>
                </Page>
            );
        }

        if (this.state.users.find(u => u.con === null && (u.uid === 0 || u.uid === null))) // not initialized yet
            return null;

        let imageContainerList = {};
        if (this.state.containers !== null) {
            Object.keys(this.state.containers).forEach(c => {
                const container = this.state.containers[c];
                const imageKey = makeKey(container.uid, container.Image);
                if (!imageContainerList[imageKey])
                    imageContainerList[imageKey] = [];
                imageContainerList[imageKey].push({
                    container,
                    stats: this.state.containersStats[makeKey(container.uid, container.Id)],
                });
            });
        } else
            imageContainerList = null;

        const loadingImages = this.state.users.find(u => u.con && !u.imagesLoaded);
        const loadingContainers = this.state.users.find(u => u.con && !u.containersLoaded);
        const loadingPods = this.state.users.find(u => u.con && !u.podsLoaded);
        const loadingQuadlets = this.state.users.find(u => u.con && !u.quadletsLoaded);

        const imageList = (
            <Images
                key="imageList"
                images={loadingImages ? null : this.state.images}
                imageContainerList={imageContainerList}
                onAddNotification={this.onAddNotification}
                textFilter={this.state.textFilter}
                ownerFilter={this.state.ownerFilter}
                showAll={ () => this.setState({ containersFilter: "all" }) }
                users={this.state.users}
            />
        );
        const containerList = (
            <Containers
                key="containerList"
                version={this.state.version}
                images={loadingImages ? null : this.state.images}
                containers={loadingContainers ? null : this.state.containers}
                pods={loadingPods ? null : this.state.pods}
                containersStats={this.state.containersStats}
                filter={this.state.containersFilter}
                handleFilterChange={this.onContainerFilterChanged}
                textFilter={this.state.textFilter}
                ownerFilter={this.state.ownerFilter}
                users={this.state.users}
                onAddNotification={this.onAddNotification}
                cgroupVersion={this.state.cgroupVersion}
                updateContainer={this.updateContainer}
                quadletContainers={loadingQuadlets ? null : this.state.quadletContainers}
                quadletPods={loadingQuadlets ? null : this.state.quadletPods}
            />
        );

        const notificationList = (
            <AlertGroup isToast>
                {this.state.notifications.map((notification, index) => {
                    return (
                        <Alert key={index} title={notification.error} variant={notification.type}
                               isLiveRegion
                               actionClose={<AlertActionCloseButton onClose={() => this.onDismissNotification(notification.index)} />}>
                            {notification.errorDetail}
                        </Alert>
                    );
                })}
            </AlertGroup>
        );

        const contextInfo = {
            cgroupVersion: this.state.cgroupVersion,
            registries: this.state.registries,
            selinuxAvailable: this.state.selinuxAvailable,
            userPodmanRestartAvailable: this.state.userPodmanRestartAvailable,
            userLingeringEnabled: this.state.userLingeringEnabled,
            version: this.state.version,
        };

        return (
            <WithPodmanInfo value={contextInfo}>
                <WithDialogs>
                    <Page id="overview" key="overview" className="pf-m-no-sidebar">
                        {notificationList}
                        <PageSection hasBodyWrapper={false} className="content-filter"
                        >
                            <ContainerHeader
                              handleFilterChanged={this.onFilterChanged}
                              handleOwnerChanged={this.onOwnerChanged}
                              ownerFilter={this.state.ownerFilter}
                              textFilter={this.state.textFilter}
                              users={this.state.users}
                            />
                        </PageSection>
                        <PageSection hasBodyWrapper={false} className='ct-pagesection-mobile'>
                            <Stack hasGutter>
                                {imageList}
                                {containerList}
                            </Stack>
                        </PageSection>
                    </Page>
                </WithDialogs>
            </WithPodmanInfo>
        );
    }
}

export default Application;
