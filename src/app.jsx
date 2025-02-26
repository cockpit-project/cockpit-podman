/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2017 Red Hat, Inc.
 *
 * Cockpit is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 *
 * Cockpit is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Cockpit; If not, see <http://www.gnu.org/licenses/>.
 */

import React from 'react';

import { Alert, AlertActionCloseButton, AlertGroup } from "@patternfly/react-core/dist/esm/components/Alert";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { EmptyState, EmptyStateHeader, EmptyStateFooter, EmptyStateIcon, EmptyStateActions, EmptyStateVariant } from "@patternfly/react-core/dist/esm/components/EmptyState";
import { Page, PageSection, PageSectionVariants } from "@patternfly/react-core/dist/esm/components/Page";
import { Stack } from "@patternfly/react-core/dist/esm/layouts/Stack";
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { WithDialogs } from "dialogs.jsx";

import cockpit from 'cockpit';
import { superuser } from "superuser";

import ContainerHeader from './ContainerHeader.jsx';
import Containers from './Containers.jsx';
import Images from './Images.jsx';
import * as client from './client.js';
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
            // currently connected services per user: { uid, name, imagesLoaded, containersLoaded, podsLoaded }
            // start with dummy state to wait for initialization
            users: [{ uid: 0, name: _("system") }, { uid: null, name: _("user") }],
            images: null,
            containers: null,
            containersFilter: "all",
            containersStats: {},
            textFilter: "",
            ownerFilter: "all",
            dropDownValue: 'Everything',
            notifications: [],
            version: '1.3.0',
            selinuxAvailable: false,
            podmanRestartAvailable: false,
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

        const options = this.state.location;
        if (value == "running") {
            delete options.container;
            this.updateUrl(Object.assign(options));
        } else {
            this.updateUrl(Object.assign(options, { container: value }));
        }
    }

    updateState(state, key, newValue) {
        this.setState(prevState => {
            return {
                [state]: { ...prevState[state], [key]: newValue }
            };
        });
    }

    updateContainerStats(uid) {
        client.streamContainerStats(uid, reply => {
            if (reply.Error != null) // executed when container stop
                console.warn("Failed to update container stats:", JSON.stringify(reply.message));
            else {
                reply.Stats.forEach(stat => this.updateState("containersStats", makeKey(uid, stat.ContainerID), stat));
            }
        }).catch(ex => {
            if (ex.cause == "no support for CGroups V1 in rootless environments" || ex.cause == "Container stats resource only available for cgroup v2") {
                console.log("This OS does not support CgroupsV2. Some information may be missing.");
            } else
                console.warn("Failed to update container stats:", JSON.stringify(ex.message));
        });
    }

    initContainers(uid) {
        return client.getContainers(uid)
                .then(containerList => Promise.all(
                    containerList.map(container => client.inspectContainer(uid, container.Id))
                ))
                .then(containerDetails => {
                    this.setState(prevState => {
                        // keep/copy the containers of other users
                        const copyContainers = {};
                        Object.entries(prevState.containers || {}).forEach(([id, container]) => {
                            if (container.uid !== uid)
                                copyContainers[id] = container;
                        });
                        for (const detail of containerDetails) {
                            detail.uid = uid;
                            detail.key = makeKey(uid, detail.Id);
                            copyContainers[detail.key] = detail;
                        }

                        const users = prevState.users.map(u => u.uid === uid ? { ...u, containersLoaded: true } : u);
                        return { containers: copyContainers, users };
                    });
                    this.updateContainerStats(uid);
                })
                .catch(e => console.warn("initContainers uid", uid, "getContainers failed:", e.toString()));
    }

    updateImages(uid) {
        client.getImages(uid)
                .then(reply => {
                    this.setState(prevState => {
                        // Copy only images that could not be deleted with this event
                        // So when event from one uid comes, only copy the other images
                        const copyImages = {};
                        Object.entries(prevState.images || {}).forEach(([Id, image]) => {
                            if (image.uid !== uid)
                                copyImages[Id] = image;
                        });
                        Object.entries(reply).forEach(([Id, image]) => {
                            image.uid = uid;
                            image.key = makeKey(uid, Id);
                            copyImages[image.key] = image;
                        });

                        const users = prevState.users.map(u => u.uid === uid ? { ...u, imagesLoaded: true } : u);
                        return { images: copyImages, users };
                    });
                })
                .catch(ex => {
                    console.warn("Failed to do updateImages for uid", uid, ":", JSON.stringify(ex));
                });
    }

    updatePods(uid) {
        return client.getPods(uid)
                .then(reply => {
                    this.setState(prevState => {
                        // Copy only pods that could not be deleted with this event
                        // So when event from one uid comes, only copy the other pods
                        const copyPods = {};
                        Object.entries(prevState.pods || {}).forEach(([id, pod]) => {
                            if (pod.uid !== uid)
                                copyPods[id] = pod;
                        });
                        for (const pod of reply || []) {
                            pod.uid = uid;
                            pod.key = makeKey(uid, pod.Id);
                            copyPods[pod.key] = pod;
                        }

                        const users = prevState.users.map(u => u.uid === uid ? { ...u, podsLoaded: true } : u);
                        return { pods: copyPods, users };
                    });
                })
                .catch(ex => {
                    console.warn("Failed to do updatePods for uid", uid, ":", JSON.stringify(ex));
                });
    }

    updateContainer(id, uid, event) {
        /* when firing off multiple calls in parallel, podman can return them in a random order.
         * This messes up the state. So we need to serialize them for a particular container. */
        const key = makeKey(uid, id);
        const wait = this.pendingUpdateContainer[key] ?? Promise.resolve();

        const new_wait = wait.then(() => client.inspectContainer(uid, id))
                .then(details => {
                    details.uid = uid;
                    details.key = key;
                    // HACK: during restart State never changes from "running"
                    //       override it to reconnect console after restart
                    if (event?.Action === "restart")
                        details.State.Status = "restarting";
                    this.updateState("containers", key, details);
                })
                .catch(e => console.warn("updateContainer uid", uid, "inspectContainer failed:", e.toString()));
        this.pendingUpdateContainer[key] = new_wait;
        new_wait.finally(() => { delete this.pendingUpdateContainer[key] });

        return new_wait;
    }

    updateImage(id, uid) {
        client.getImages(uid, id)
                .then(reply => {
                    const image = reply[id];
                    image.uid = uid;
                    image.key = makeKey(uid, id);
                    this.updateState("images", image.key, image);
                })
                .catch(ex => {
                    console.warn("Failed to do updateImage for uid", uid, ":", JSON.stringify(ex));
                });
    }

    updatePod(id, uid) {
        return client.getPods(uid, id)
                .then(reply => {
                    if (reply && reply.length > 0) {
                        const pod = reply[0];

                        pod.uid = uid;
                        pod.key = makeKey(uid, id);
                        this.updateState("pods", pod.key, pod);
                    }
                })
                .catch(ex => {
                    console.warn("Failed to do updatePod for uid", uid, ":", JSON.stringify(ex));
                });
    }

    // see https://docs.podman.io/en/latest/markdown/podman-events.1.html

    handleImageEvent(event, uid) {
        switch (event.Action) {
        case 'push':
        case 'save':
        case 'tag':
            this.updateImage(event.Actor.ID, uid);
            break;
        case 'pull': // Pull event has not event.id
        case 'untag':
        case 'remove':
        case 'prune':
        case 'build':
            this.updateImages(uid);
            break;
        default:
            console.warn('Unhandled event type ', event.Type, event.Action);
        }
    }

    handleContainerEvent(event, uid) {
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
                ? this.updatePod(event.Actor.Attributes.podId, uid)
                : this.updatePods(uid)
            ).then(() => this.updateContainer(id, uid, event));
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
            this.updateContainer(id, uid, event);
            break;

        case 'remove':
            this.setState(prevState => {
                const containers = { ...prevState.containers };
                delete containers[makeKey(uid, id)];
                let pods;

                if (event.Actor.Attributes.podId) {
                    const podKey = makeKey(uid, event.Actor.Attributes.podId);
                    const newPod = { ...prevState.pods[podKey] };
                    newPod.Containers = newPod.Containers.filter(container => container.Id !== id);
                    pods = { ...prevState.pods, [podKey]: newPod };
                } else {
                    // HACK: with podman < 4.3.0 we don't get a pod event when a container in a pod is removed
                    // https://github.com/containers/podman/issues/15408
                    pods = prevState.pods;
                    this.updatePods(uid);
                }

                return { containers, pods };
            });
            break;

        // only needs to update the Image list, this ought to be an image event
        case 'commit':
            this.updateImages(uid);
            break;
        default:
            console.warn('Unhandled event type ', event.Type, event.Action);
        }
    }

    handlePodEvent(event, uid) {
        switch (event.Action) {
        case 'create':
        case 'kill':
        case 'pause':
        case 'start':
        case 'stop':
        case 'unpause':
            this.updatePod(event.Actor.ID, uid);
            break;
        case 'remove':
            this.setState(prevState => {
                const pods = { ...prevState.pods };
                delete pods[makeKey(uid, event.Actor.ID)];
                return { pods };
            });
            break;
        default:
            console.warn('Unhandled event type ', event.Type, event.Action);
        }
    }

    handleEvent(event, uid) {
        switch (event.Type) {
        case 'container':
            this.handleContainerEvent(event, uid);
            break;
        case 'image':
            this.handleImageEvent(event, uid);
            break;
        case 'pod':
            this.handlePodEvent(event, uid);
            break;
        default:
            console.warn('Unhandled event type ', event.Type);
        }
    }

    cleanupAfterService(uid) {
        ["images", "containers", "pods"].forEach(t => {
            if (this.state[t])
                this.setState(prevState => {
                    const copy = {};
                    Object.entries(prevState[t] || {}).forEach(([id, v]) => {
                        if (v.uid !== uid)
                            copy[id] = v;
                    });
                    return { [t]: copy };
                });
        });

        this.setState(prevState => ({ users: prevState.users.filter(u => u.uid !== uid) }));

        // regardless of whose service went away (system/user), it makes owner filter disappear, so reset it
        this.onOwnerChanged("all");
    }

    async init(uid, username) {
        const system = uid === 0;

        try {
            await cockpit.spawn(["systemctl", ...(system ? [] : ["--user"]), "start", "podman.socket"],
                                { superuser: system ? "require" : null, err: "message" });
            const reply = await client.getInfo(uid);
            this.setState(prevState => {
                const users = prevState.users.filter(u => u.uid !== uid);
                users.push({ uid, name: username, containersLoaded: false, podsLoaded: false, imagesLoaded: false });
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

        this.updateImages(uid);
        this.initContainers(uid);
        this.updatePods(uid);

        client.streamEvents(uid, message => this.handleEvent(message, uid))
                .catch(e => console.error("init uid", uid, "streamEvents failed:", e.toString()))
                .finally(() => this.cleanupAfterService(uid));

        // HACK: Listen for podman socket/service going away; this is only necessary with the C bridge
        // (Debian 12, RHEL 8). With the Python bridge, the above streamEvents() resolves when the service goes away.
        const address = rest.getAddress(uid);
        const ch = cockpit.channel({ unix: address.path, superuser: address.superuser, payload: "stream" });
        ch.addEventListener("close", () => {
            console.log("init uid", uid, "podman service closed");
            this.cleanupAfterService(uid);
        });

        ch.send("GET " + client.VERSION + "libpod/events HTTP/1.0\r\nContent-Length: 0\r\n\r\n");
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
        });

        cockpit.spawn("selinuxenabled", { error: "ignore" })
                .then(() => this.setState({ selinuxAvailable: true }))
                .catch(() => this.setState({ selinuxAvailable: false }));

        cockpit.spawn(["systemctl", "show", "--value", "-p", "LoadState", "podman-restart"], { environ: ["LC_ALL=C"], error: "ignore" })
                .then(out => this.setState({ podmanRestartAvailable: out.trim() === "loaded" }));

        cockpit.addEventListener("locationchanged", this.onNavigate);
        this.onNavigate();
    }

    componentWillUnmount() {
        cockpit.removeEventListener("locationchanged", this.onNavigate);
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
                if (["user", "all"].includes(options.owner)) {
                    this.setState({ ownerFilter: options.owner });
                } else if (options.owner === undefined) {
                    this.setState({ ownerFilter: "all" });
                } else {
                    const uid = parseInt(options.owner);
                    if (!isNaN(uid))
                        this.setState({ ownerFilter: uid });
                    else
                        console.log("Ignoring invalid URL owner value:", options.owner);
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
                <Page>
                    <PageSection variant={PageSectionVariants.light}>
                        <EmptyState variant={EmptyStateVariant.full}>
                            <EmptyStateHeader titleText={_("Podman service failed")} icon={<EmptyStateIcon icon={ExclamationCircleIcon} />} headingLevel="h2" />
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

        const loadingImages = this.state.users.find(u => !u.imagesLoaded);
        const loadingContainers = this.state.users.find(u => !u.containersLoaded);
        const loadingPods = this.state.users.find(u => !u.podsLoaded);

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
            podmanRestartAvailable: this.state.podmanRestartAvailable,
            userPodmanRestartAvailable: this.state.userPodmanRestartAvailable,
            userLingeringEnabled: this.state.userLingeringEnabled,
            version: this.state.version,
        };

        return (
            <WithPodmanInfo value={contextInfo}>
                <WithDialogs>
                    <Page id="overview" key="overview">
                        {notificationList}
                        <PageSection className="content-filter" padding={{ default: 'noPadding' }}
                          variant={PageSectionVariants.light}>
                            <ContainerHeader
                              handleFilterChanged={this.onFilterChanged}
                              handleOwnerChanged={this.onOwnerChanged}
                              ownerFilter={this.state.ownerFilter}
                              textFilter={this.state.textFilter}
                              users={this.state.users}
                            />
                        </PageSection>
                        <PageSection className='ct-pagesection-mobile'>
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
