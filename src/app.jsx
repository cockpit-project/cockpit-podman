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
import {
    Page, PageSection, PageSectionVariants,
    Alert, AlertActionLink, AlertActionCloseButton, AlertGroup,
    Button, Checkbox, Title,
    EmptyState, EmptyStateVariant, EmptyStateIcon, EmptyStateSecondaryActions,
    Stack,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { WithDialogs } from "dialogs.jsx";

import cockpit from 'cockpit';
import { superuser } from "superuser";
import ContainerHeader from './ContainerHeader.jsx';
import Containers from './Containers.jsx';
import Images from './Images.jsx';
import * as client from './client.js';

const _ = cockpit.gettext;

class Application extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            systemServiceAvailable: null,
            userServiceAvailable: null,
            enableService: true,
            images: null,
            userImagesLoaded: false,
            systemImagesLoaded: false,
            containers: null,
            containersFilter: "all",
            containersStats: {},
            containersDetails: {},
            userContainersLoaded: null,
            systemContainersLoaded: null,
            userPodsLoaded: null,
            systemPodsLoaded: null,
            userServiceExists: false,
            textFilter: "",
            ownerFilter: "all",
            dropDownValue: 'Everything',
            notifications: [],
            showStartService: true,
            version: '1.3.0',
            selinuxAvailable: false,
            podmanRestartAvailable: false,
            userPodmanRestartAvailable: false,
            currentUser: _("User"),
            userLingeringEnabled: null,
            privileged: false,
            location: {},
        };
        this.onAddNotification = this.onAddNotification.bind(this);
        this.updateState = this.updateState.bind(this);
        this.onDismissNotification = this.onDismissNotification.bind(this);
        this.onFilterChanged = this.onFilterChanged.bind(this);
        this.onOwnerChanged = this.onOwnerChanged.bind(this);
        this.onContainerFilterChanged = this.onContainerFilterChanged.bind(this);
        this.updateImagesAfterEvent = this.updateImagesAfterEvent.bind(this);
        this.updateContainerAfterEvent = this.updateContainerAfterEvent.bind(this);
        this.updateContainerStats = this.updateContainerStats.bind(this);
        this.startService = this.startService.bind(this);
        this.goToServicePage = this.goToServicePage.bind(this);
        this.handleImageEvent = this.handleImageEvent.bind(this);
        this.handleContainerEvent = this.handleContainerEvent.bind(this);
        this.checkUserService = this.checkUserService.bind(this);
        this.onNavigate = this.onNavigate.bind(this);
    }

    onAddNotification(notification) {
        notification.index = this.state.notifications.length;

        this.setState({
            notifications: [
                ...this.state.notifications,
                notification
            ]
        });
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

        const options = this.state.location;
        if (value === "") {
            delete options.name;
            this.updateUrl(Object.assign(options));
        } else {
            this.updateUrl(Object.assign(this.state.location, { name: value }));
        }
    }

    onOwnerChanged(value) {
        this.setState({
            ownerFilter: value
        });

        const options = this.state.location;
        if (value == "all") {
            delete options.owner;
            this.updateUrl(Object.assign(options));
        } else {
            this.updateUrl(Object.assign(options, { owner: value }));
        }
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

    updateState(state, id, newValue) {
        this.setState(prevState => {
            const copyState = Object.assign({}, prevState[state]);

            copyState[id] = newValue;

            return {
                [state]: copyState,
            };
        });
    }

    updateContainerStats(system) {
        client.getContainerStats(system, reply => {
            if (reply.Error != null) // executed when container stop
                console.warn("Failed to update container stats:", JSON.stringify(reply.message));
            else {
                reply.Stats.forEach(stat => this.updateState("containersStats", stat.ContainerID + system.toString(), stat));
            }
        }).catch(ex => {
            if (ex.cause == "no support for CGroups V1 in rootless environments" || ex.cause == "Container stats resource only available for cgroup v2") {
                console.log("This OS does not support CgroupsV2. Some information may be missing.");
            } else
                console.warn("Failed to update container stats:", JSON.stringify(ex.message));
        });
    }

    inspectContainerDetail(id, system) {
        client.inspectContainer(system, id)
                .then(reply => {
                    this.updateState("containersDetails", reply.Id + system.toString(), reply);
                })
                .catch(e => console.log(e));
    }

    isContainerCheckpointPresent(id, system) {
        return client.inspectContainer(system, id)
                .then(inspectResult => {
                    const checkpointPath = inspectResult.StaticDir + "/checkpoint";
                    return cockpit.script(`test -d ${checkpointPath}; echo $?`, [],
                                          system ? { superuser: "require" } : {});
                })
                .then(scriptResult => scriptResult === "0\n");
    }

    updateContainersAfterEvent(system, init) {
        client.getContainers(system)
                .then(reply => Promise.all(
                    (reply || []).map(container =>
                        this.isContainerCheckpointPresent(container.Id, system)
                                .then(checkpointPresent => {
                                    const newContainer = Object.assign({}, container);
                                    newContainer.hasCheckpoint = checkpointPresent;
                                    return newContainer;
                                })
                    )
                ))
                .then(reply => {
                    this.setState(prevState => {
                        // Copy only containers that could not be deleted with this event
                        // So when event from system come, only copy user containers and vice versa
                        const copyContainers = {};
                        Object.entries(prevState.containers || {}).forEach(([id, container]) => {
                            if (container.isSystem !== system)
                                copyContainers[id] = container;
                        });
                        for (const container of reply || []) {
                            container.isSystem = system;
                            copyContainers[container.Id + system.toString()] = container;
                        }

                        return {
                            containers: copyContainers,
                            [system ? "systemContainersLoaded" : "userContainersLoaded"]: true,
                        };
                    });
                    if (init) {
                        this.updateContainerStats(system);
                        for (const container of reply || []) {
                            this.inspectContainerDetail(container.Id, system);
                        }
                    }
                })
                .catch(console.log);
    }

    updateImagesAfterEvent(system) {
        client.getImages(system)
                .then(reply => {
                    this.setState(prevState => {
                        // Copy only images that could not be deleted with this event
                        // So when event from system come, only copy user images and vice versa
                        const copyImages = {};
                        Object.entries(prevState.images || {}).forEach(([Id, image]) => {
                            if (image.isSystem !== system)
                                copyImages[Id] = image;
                        });
                        Object.entries(reply).forEach(([Id, image]) => {
                            image.isSystem = system;
                            copyImages[Id + system.toString()] = image;
                        });

                        return {
                            images: copyImages,
                            [system ? "systemImagesLoaded" : "userImagesLoaded"]: true
                        };
                    });
                })
                .catch(ex => {
                    console.warn("Failed to do Update Images:", JSON.stringify(ex));
                });
    }

    updatePodsAfterEvent(system) {
        client.getPods(system)
                .then(reply => {
                    this.setState(prevState => {
                        // Copy only pods that could not be deleted with this event
                        // So when event from system come, only copy user pods and vice versa
                        const copyPods = {};
                        Object.entries(prevState.pods || {}).forEach(([id, pod]) => {
                            if (pod.isSystem !== system)
                                copyPods[id] = pod;
                        });
                        for (const pod of reply || []) {
                            pod.isSystem = system;
                            copyPods[pod.Id + system.toString()] = pod;
                        }

                        return {
                            pods: copyPods,
                            [system ? "systemPodsLoaded" : "userPodsLoaded"]: true,
                        };
                    });
                })
                .catch(ex => {
                    console.warn("Failed to do Update Pods:", JSON.stringify(ex));
                });
    }

    updateContainerAfterEvent(id, system, event) {
        client.getContainers(system, id)
                .then(reply => Promise.all(
                    (reply || []).map(container =>
                        this.isContainerCheckpointPresent(container.Id, system)
                                .then(checkpointPresent => {
                                    const newContainer = Object.assign({}, container);
                                    newContainer.hasCheckpoint = checkpointPresent;
                                    return newContainer;
                                })
                    )
                ))
                .then(reply => {
                    if (reply && reply.length > 0) {
                        reply = reply[0];

                        reply.isSystem = system;
                        // HACK: during restart State never changes from "running"
                        //       override it to reconnect console after restart
                        if (event && event.Action === "restart")
                            reply.State = "restarting";
                        this.updateState("containers", reply.Id + system.toString(), reply);
                        if (reply.State == "running") {
                            this.inspectContainerDetail(reply.Id, system);
                        } else {
                            this.setState(prevState => {
                                const copyDetails = Object.assign({}, prevState.containersDetails);
                                const copyStats = Object.assign({}, prevState.containersStats);
                                delete copyDetails[reply.Id + system.toString()];
                                delete copyStats[reply.Id + system.toString()];
                                return { containersDetails: copyDetails, containersStats: copyStats };
                            });
                        }
                    }
                })
                .catch(console.log);
    }

    updateImageAfterEvent(id, system) {
        client.getImages(system, id)
                .then(reply => {
                    const immage = reply[id];
                    immage.isSystem = system;
                    this.updateState("images", id + system.toString(), immage);
                })
                .catch(ex => {
                    console.warn("Failed to do Update Image:", JSON.stringify(ex));
                });
    }

    updatePodAfterEvent(id, system) {
        client.getPods(system, id)
                .then(reply => {
                    if (reply && reply.length > 0) {
                        reply = reply[0];

                        reply.isSystem = system;
                        this.updateState("pods", reply.Id + system.toString(), reply);
                    }
                })
                .catch(ex => {
                    console.warn("Failed to do Update Pod:", JSON.stringify(ex));
                });
    }

    handleImageEvent(event, system) {
        switch (event.Action) {
        case 'push':
        case 'save':
        case 'tag':
            this.updateImageAfterEvent(event.Actor.ID, system);
            break;
        case 'pull': // Pull event has not event.id
        case 'untag':
        case 'remove':
        case 'prune':
        case 'build':
            this.updateImagesAfterEvent(system);
            break;
        default:
            console.warn('Unhandled event type ', event.Type, event.Action);
        }
    }

    handleContainerEvent(event, system) {
        switch (event.Action) {
        /* The following events do not need to trigger any state updates */
        case 'attach':
        case 'exec':
        case 'export':
        case 'import':
        case 'init':
        case 'wait':
            break;
        /* The following events need only to update the Container list
         * We do get the container affected in the event object but for
         * now we 'll do a batch update
         */
        case 'start':
            // HACK: We don't get 'started' event for pods got started by the first container which was added to them
            // https://github.com/containers/podman/issues/7213
            if (event.Actor.Attributes.podId) {
                this.updatePodAfterEvent(event.Actor.Attributes.podId, system);
            } else {
                this.updatePodsAfterEvent(system);
            }
            this.updateContainerAfterEvent(event.Actor.ID, system, event);
            break;
        case 'checkpoint':
        case 'create':
        case 'died':
        case 'exec_died':
        case 'kill':
        case 'mount':
        case 'pause':
        case 'prune':
        case 'restart':
        case 'restore':
        case 'stop':
        case 'sync':
        case 'unmount':
        case 'unpause':
        case 'rename': // rename event is available starting podman v4.1; until then the container does not get refreshed after renaming
            this.updateContainerAfterEvent(event.Actor.ID, system, event);
            break;
        case 'remove':
        case 'cleanup':
            // HACK: we don't get a pod event when a container in a pod is removed.
            // https://github.com/containers/podman/issues/15408
            if (event.Actor.Attributes.podId) {
                this.updatePodAfterEvent(event.Actor.Attributes.podId, system);
            } else {
                this.updatePodsAfterEvent(system);
            }
            this.updateContainersAfterEvent(system);
            break;
        /* The following events need only to update the Image list */
        case 'commit':
            this.updateImagesAfterEvent(system);
            break;
        default:
            console.warn('Unhandled event type ', event.Type, event.Action);
        }
    }

    handlePodEvent(event, system) {
        switch (event.Action) {
        case 'create':
        case 'kill':
        case 'pause':
        case 'start':
        case 'stop':
        case 'unpause':
            this.updatePodAfterEvent(event.Actor.ID, system);
            break;
        case 'remove':
            this.updatePodsAfterEvent(system);
            break;
        default:
            console.warn('Unhandled event type ', event.Type, event.Action);
        }
    }

    handleEvent(event, system) {
        switch (event.Type) {
        case 'container':
            this.handleContainerEvent(event, system);
            break;
        case 'image':
            this.handleImageEvent(event, system);
            break;
        case 'pod':
            this.handlePodEvent(event, system);
            break;
        default:
            console.warn('Unhandled event type ', event.Type);
        }
    }

    cleanupAfterService(system, key) {
        ["images", "containers", "pods"].forEach(t => {
            if (this.state[t])
                this.setState(prevState => {
                    const copy = {};
                    Object.entries(prevState[t] || {}).forEach(([id, v]) => {
                        if (v.isSystem !== system)
                            copy[id] = v;
                    });
                    return { [t]: copy };
                });
        });
    }

    init(system) {
        client.getInfo(system)
                .then(reply => {
                    this.setState({
                        [system ? "systemServiceAvailable" : "userServiceAvailable"]: true,
                        version: reply.version.Version,
                        registries: reply.registries,
                        cgroupVersion: reply.host.cgroupVersion,
                    });
                    this.updateImagesAfterEvent(system);
                    this.updateContainersAfterEvent(system, true);
                    this.updatePodsAfterEvent(system);
                    client.streamEvents(system,
                                        message => this.handleEvent(message, system))
                            .then(() => {
                                this.setState({ [system ? "systemServiceAvailable" : "userServiceAvailable"]: false });
                                this.cleanupAfterService(system);
                            })
                            .catch(e => {
                                console.log(e);
                                this.setState({ [system ? "systemServiceAvailable" : "userServiceAvailable"]: false });
                                this.cleanupAfterService(system);
                            });

                    // Listen if podman is still running
                    const ch = cockpit.channel({ superuser: system ? "require" : null, payload: "stream", unix: client.getAddress(system) });
                    ch.addEventListener("close", () => {
                        this.setState({ [system ? "systemServiceAvailable" : "userServiceAvailable"]: false });
                        this.cleanupAfterService(system);
                    });

                    ch.send("GET " + client.VERSION + "libpod/events HTTP/1.0\r\nContent-Length: 0\r\n\r\n");
                })
                .catch(() => {
                    this.setState({
                        [system ? "systemServiceAvailable" : "userServiceAvailable"]: false,
                        [system ? "systemContainersLoaded" : "userContainersLoaded"]: true,
                        [system ? "systemImagesLoaded" : "userImagesLoaded"]: true,
                        [system ? "systemPodsLoaded" : "userPodsLoaded"]: true
                    });
                });
    }

    componentDidMount() {
        this.init(true);
        cockpit.script("[ `id -u` -eq 0 ] || echo $XDG_RUNTIME_DIR")
                .done(xrd => {
                    const isRoot = !xrd || xrd.split("/").pop() == "root";
                    if (!isRoot) {
                        sessionStorage.setItem('XDG_RUNTIME_DIR', xrd.trim());
                        this.init(false);
                        this.checkUserService();
                    } else {
                        this.setState({
                            userImagesLoaded: true,
                            userContainersLoaded: true,
                            userPodsLoaded: true,
                            userServiceExists: false
                        });
                    }
                })
                .fail(e => console.log("Could not read $XDG_RUNTIME_DIR: ", e.message));
        cockpit.spawn("selinuxenabled", { error: "ignore" })
                .then(() => this.setState({ selinuxAvailable: true }))
                .catch(() => this.setState({ selinuxAvailable: false }));

        cockpit.spawn(["systemctl", "show", "--value", "-p", "LoadState", "podman-restart"], { environ: ["LC_ALL=C"], error: "ignore" })
                .then(out => this.setState({ podmanRestartAvailable: out.trim() === "loaded" }));

        superuser.addEventListener("changed", () => this.setState({ privileged: !!superuser.allowed }));
        this.setState({ privileged: superuser.allowed });

        cockpit.user().then(user => {
            this.setState({ currentUser: user.name || _("User") });
            // HACK: https://github.com/systemd/systemd/issues/22244#issuecomment-1210357701
            cockpit.file(`/var/lib/systemd/linger/${user.name}`).watch((content, tag) => {
                if (content == null && tag === '-') {
                    this.setState({ userLingeringEnabled: false });
                } else {
                    this.setState({ userLingeringEnabled: true });
                }
            });
        });

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
                const owners = ["user", "system", "all"];
                if (owners.indexOf(options.owner) !== -1) {
                    this.onOwnerChanged(options.owner);
                }
            }
        });
    }

    checkUserService() {
        const argv = ["systemctl", "--user", "is-enabled", "podman.socket"];

        cockpit.spawn(["systemctl", "--user", "show", "--value", "-p", "LoadState", "podman-restart"], { environ: ["LC_ALL=C"], error: "ignore" })
                .then(out => this.setState({ userPodmanRestartAvailable: out.trim() === "loaded" }));

        cockpit.spawn(argv, { environ: ["LC_ALL=C"], err: "out" })
                .then(() => this.setState({ userServiceExists: true }))
                .catch((_, response) => {
                    if (response.trim() !== "disabled")
                        this.setState({ userServiceExists: false });
                    else
                        this.setState({ userServiceExists: true });
                });
    }

    startService(e) {
        if (!e || e.button !== 0)
            return;

        let argv;
        if (this.state.enableService)
            argv = ["systemctl", "enable", "--now", "podman.socket"];
        else
            argv = ["systemctl", "start", "podman.socket"];

        cockpit.spawn(argv, { superuser: "require", err: "message" })
                .then(() => this.init(true))
                .catch(err => {
                    this.setState({
                        systemServiceAvailable: false,
                        systemContainersLoaded: true,
                        systemImagesLoaded: true
                    });
                    console.warn("Failed to start system podman.socket:", JSON.stringify(err));
                });

        if (this.state.enableService)
            argv = ["systemctl", "--user", "enable", "--now", "podman.socket"];
        else
            argv = ["systemctl", "--user", "start", "podman.socket"];

        cockpit.spawn(argv, { err: "message" })
                .then(() => this.init(false))
                .catch(err => {
                    this.setState({
                        userServiceAvailable: false,
                        userContainersLoaded: true,
                        userPodsLoaded: true,
                        userImagesLoaded: true
                    });
                    console.warn("Failed to start user podman.socket:", JSON.stringify(err));
                });
    }

    goToServicePage(e) {
        if (!e || e.button !== 0)
            return;
        cockpit.jump("/system/services#/podman.socket");
    }

    render() {
        if (this.state.systemServiceAvailable === null && this.state.userServiceAvailable === null) // not detected yet
            return null;

        if (!this.state.systemServiceAvailable && !this.state.userServiceAvailable) {
            return (
                <EmptyState variant={EmptyStateVariant.full}>
                    <EmptyStateIcon icon={ExclamationCircleIcon} />
                    <Title headingLevel="h2" size="lg">
                        { _("Podman service is not active") }
                    </Title>
                    <Checkbox isChecked={this.state.enableService}
                              id="enable"
                              label={_("Automatically start podman on boot")}
                              onChange={ checked => this.setState({ enableService: checked }) } />
                    <Button onClick={this.startService}>
                        {_("Start podman")}
                    </Button>
                    { cockpit.manifests.system &&
                        <EmptyStateSecondaryActions>
                            <Button variant="link" onClick={this.goToServicePage}>
                                {_("Troubleshoot")}
                            </Button>
                        </EmptyStateSecondaryActions>
                    }
                </EmptyState>
            );
        }

        let imageContainerList = {};
        if (this.state.containers !== null) {
            Object.keys(this.state.containers).forEach(c => {
                const container = this.state.containers[c];
                const image = container.ImageID + container.isSystem.toString();
                if (imageContainerList[image]) {
                    imageContainerList[image].push({
                        container: container,
                        stats: this.state.containersStats[container.Id + container.isSystem.toString()],
                    });
                } else {
                    imageContainerList[image] = [{
                        container: container,
                        stats: this.state.containersStats[container.Id + container.isSystem.toString()]
                    }];
                }
            });
        } else
            imageContainerList = null;

        let startService = "";
        const action = (<>
            <AlertActionLink variant='secondary' onClick={this.startService}>{_("Start")}</AlertActionLink>
            <AlertActionCloseButton onClose={() => this.setState({ showStartService: false })} />
        </>);
        if (!this.state.systemServiceAvailable && this.state.privileged) {
            startService = <Alert variant='default'
                title={_("System Podman service is also available")}
                actionClose={action} />;
        }
        if (!this.state.userServiceAvailable && this.state.userServiceExists) {
            startService = <Alert variant='default'
                title={_("User Podman service is also available")}
                actionClose={action} />;
        }

        const imageList =
            <Images
                key="imageList"
                images={this.state.systemImagesLoaded && this.state.userImagesLoaded ? this.state.images : null}
                imageContainerList={imageContainerList}
                onAddNotification={this.onAddNotification}
                textFilter={this.state.textFilter}
                ownerFilter={this.state.ownerFilter}
                showAll={ () => this.setState({ containersFilter: "all" }) }
                user={this.state.currentUser}
                userServiceAvailable={this.state.userServiceAvailable}
                systemServiceAvailable={this.state.systemServiceAvailable}
                registries={this.state.registries}
                selinuxAvailable={this.state.selinuxAvailable}
                podmanRestartAvailable={this.state.podmanRestartAvailable}
                userPodmanRestartAvailable={this.state.userPodmanRestartAvailable}
                userLingeringEnabled={this.state.userLingeringEnabled}
            />;
        const containerList =
            <Containers
                key="containerList"
                version={this.state.version}
                images={this.state.systemImagesLoaded && this.state.userImagesLoaded ? this.state.images : null}
                containers={this.state.systemContainersLoaded && this.state.userContainersLoaded ? this.state.containers : null}
                pods={this.state.systemPodsLoaded && this.state.userPodsLoaded ? this.state.pods : null}
                containersStats={this.state.containersStats}
                containersDetails={this.state.containersDetails}
                filter={this.state.containersFilter}
                handleFilterChange={this.onContainerFilterChanged}
                textFilter={this.state.textFilter}
                ownerFilter={this.state.ownerFilter}
                user={this.state.currentUser}
                onAddNotification={this.onAddNotification}
                userServiceAvailable={this.state.userServiceAvailable}
                systemServiceAvailable={this.state.systemServiceAvailable}
                cgroupVersion={this.state.cgroupVersion}
                registries={this.state.registries}
                selinuxAvailable={this.state.selinuxAvailable}
                podmanRestartAvailable={this.state.podmanRestartAvailable}
                userPodmanRestartAvailable={this.state.userPodmanRestartAvailable}
                userLingeringEnabled={this.state.userLingeringEnabled}
                updateContainerAfterEvent={this.updateContainerAfterEvent}
            />;

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

        return (
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
                            twoOwners={this.state.systemServiceAvailable && this.state.userServiceAvailable}
                            user={this.state.currentUser}
                        />
                    </PageSection>
                    <PageSection className='ct-pagesection-mobile'>
                        <Stack hasGutter>
                            { this.state.showStartService ? startService : null }
                            {imageList}
                            {containerList}
                        </Stack>
                    </PageSection>
                </Page>
            </WithDialogs>
        );
    }
}

export default Application;
