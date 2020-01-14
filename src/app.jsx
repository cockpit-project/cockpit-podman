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
import { ToastNotificationList } from 'patternfly-react';
import { Alert, AlertActionLink, AlertActionCloseButton } from '@patternfly/react-core';

import cockpit from 'cockpit';
import ContainerHeader from './ContainerHeader.jsx';
import Containers from './Containers.jsx';
import Images from './Images.jsx';
import * as utils from './util.js';

const _ = cockpit.gettext;
const permission = cockpit.permission({ admin: true });

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
            containersStats: {},
            userContainersLoaded: null,
            systemContainersLoaded: null,
            userServiceExists: false,
            onlyShowRunning: true,
            textFilter: "",
            dropDownValue: 'Everything',
            notifications: [],
            showStartService: true,
            version: '1.3.0',
        };
        this.onAddNotification = this.onAddNotification.bind(this);
        this.updateState = this.updateState.bind(this);
        this.onDismissNotification = this.onDismissNotification.bind(this);
        this.onChange = this.onChange.bind(this);
        this.onFilterChanged = this.onFilterChanged.bind(this);
        this.updateImagesAfterEvent = this.updateImagesAfterEvent.bind(this);
        this.updateContainerAfterEvent = this.updateContainerAfterEvent.bind(this);
        this.updateContainerStats = this.updateContainerStats.bind(this);
        this.startService = this.startService.bind(this);
        this.showAll = this.showAll.bind(this);
        this.goToServicePage = this.goToServicePage.bind(this);
        this.handleImageEvent = this.handleImageEvent.bind(this);
        this.handleContainerEvent = this.handleContainerEvent.bind(this);
        this.checkUserService = this.checkUserService.bind(this);
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

    onChange(value) {
        this.setState({
            onlyShowRunning: value != "all"
        });
    }

    onFilterChanged(value) {
        this.setState({
            textFilter: value
        });
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

    updateContainerStats(id, system) {
        utils.podmanCall("GetContainerStats", { name: id }, system)
                .then(reply => {
                    this.updateState("containersStats", reply.container.id + system.toString(), reply.container);
                })
                .catch(ex => {
                    if (ex.error === "io.podman.ErrRequiresCgroupsV2ForRootless") {
                        console.log("This OS does not support CgroupsV2. Some information may be missing.");
                        this.updateState("containersStats", id + system.toString(), -1);
                    } else
                        console.warn("Failed to update container stats:", JSON.stringify(ex));
                });
    }

    updateContainersAfterEvent(system) {
        utils.podmanCall("ListContainers", {}, system)
                .then(reply => {
                    this.setState(prevState => {
                        // Copy only containers that could not be deleted with this event
                        // So when event from system come, only copy user containers and vice versa
                        const copyContainers = {};
                        Object.entries(prevState.containers || {}).forEach(([id, container]) => {
                            if (container.isSystem !== system)
                                copyContainers[id] = container;
                        });
                        for (const container of reply.containers || []) {
                            container.isSystem = system;
                            copyContainers[container.id + system.toString()] = container;
                            if (container.status === "running")
                                this.updateContainerStats(container.id, system);
                        }

                        return {
                            containers: copyContainers,
                            [system ? "systemContainersLoaded" : "userContainersLoaded"]: true,
                        };
                    });
                })
                .catch(e => console.log(e));
    }

    updateImagesAfterEvent(system) {
        utils.updateImages(system)
                .then(reply => {
                    this.setState(prevState => {
                        // Copy only images that could not be deleted with this event
                        // So when event from system come, only copy user images and vice versa
                        const copyImages = {};
                        Object.entries(prevState.images || {}).forEach(([id, image]) => {
                            if (image.isSystem !== system)
                                copyImages[id] = image;
                        });
                        Object.entries(reply).forEach(([id, image]) => {
                            image.isSystem = system;
                            copyImages[id + system.toString()] = image;
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

    updateContainerAfterEvent(id, system) {
        utils.podmanCall("GetContainer", { id: id }, system)
                .then(reply => {
                    reply.container.isSystem = system;
                    this.updateState("containers", reply.container.id + system.toString(), reply.container);
                    if (reply.container.status == "running")
                        this.updateContainerStats(reply.container.id, system);
                    else {
                        this.setState(prevState => {
                            const copyStats = Object.assign({}, prevState.containersStats);
                            delete copyStats[reply.container.id + system.toString()];
                            return { containersStats: copyStats };
                        });
                    }
                })
                .catch(e => console.log(e));
    }

    updateImageAfterEvent(id, system) {
        utils.updateImage(id, system)
                .then(reply => {
                    reply.image.isSystem = system;
                    this.updateState("images", reply.image.id + system.toString(), reply.image);
                })
                .catch(ex => {
                    console.warn("Failed to do Update Image:", JSON.stringify(ex));
                });
    }

    handleImageEvent(event, system) {
        switch (event.status) {
        case 'push':
        case 'save':
        case 'tag':
            this.updateImageAfterEvent(event.id, system);
            break;
        case 'pull': // Pull event has not event.id
        case 'untag':
        case 'remove':
        case 'prune':
            this.updateImagesAfterEvent(system);
            break;
        default:
            console.warn('Unhandled event type ', event.type, event.status);
        }
    }

    handleContainerEvent(event, system) {
        switch (event.status) {
        /* The following events do not need to trigger any state updates */
        case 'attach':
        case 'exec':
        case 'export':
        case 'import':
        case 'init':
        case 'wait':
        case 'restart': // We get seperate died-init-start events after the restart event
            break;
        /* The following events need only to update the Container list
         * We do get the container affected in the event object but for
         * now we 'll do a batch update
         */
        case 'checkpoint':
        case 'create':
        case 'died':
        case 'kill':
        case 'mount':
        case 'pause':
        case 'prune':
        case 'restore':
        case 'start':
        case 'stop':
        case 'sync':
        case 'unmount':
        case 'unpause':
            this.updateContainerAfterEvent(event.id, system);
            break;
        case 'remove':
        case 'cleanup':
            this.updateContainersAfterEvent(system);
            break;
        /* The following events need only to update the Image list */
        case 'commit':
            this.updateImagesAfterEvent(system);
            break;
        default:
            console.warn('Unhandled event type ', event.type, event.status);
        }
    }

    handleEvent(event, system) {
        switch (event.type) {
        case 'container':
            this.handleContainerEvent(event, system);
            break;
        case 'image':
            this.handleImageEvent(event, system);
            break;
        default:
            console.warn('Unhandled event type ', event.type);
        }
    }

    init(system) {
        utils.podmanCall("GetVersion", {}, system)
                .then(reply => {
                    this.setState({ [system ? "systemServiceAvailable" : "userServiceAvailable"]: true, version: reply.version });
                    this.updateImagesAfterEvent(system);
                    this.updateContainersAfterEvent(system);
                    utils.monitor("GetEvents", {},
                                  message => {
                                      message.parameters && message.parameters.events && this.handleEvent(message.parameters.events, system);
                                  }, isSystem => {
                                      this.setState({ [isSystem ? "systemServiceAvailable" : "userServiceAvailable"]: false });
                                  },
                                  system
                    );
                })
                .catch(error => {
                    if (error.name === "ConnectionClosed") {
                        this.setState({
                            [system ? "systemServiceAvailable" : "userServiceAvailable"]: false,
                            [system ? "systemContainersLoaded" : "userContainersLoaded"]: true,
                            [system ? "systemImagesLoaded" : "userImagesLoaded"]: true
                        });
                    } else
                        console.error("Failed to call GetVersion():", error);
                });
    }

    componentDidMount() {
        this.checkUserService();
        this.init(true);
        cockpit.script("echo $XDG_RUNTIME_DIR")
                .done(xrd => {
                    sessionStorage.setItem('XDG_RUNTIME_DIR', xrd.trim());
                    this.init(false);
                })
                .fail(e => console.log("Could not read $XDG_RUNTIME_DIR: ", e.message));
    }

    checkUserService() {
        const argv = ["systemctl", "--user", "is-enabled", "io.podman.socket"];

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
            argv = ["systemctl", "enable", "--now", "io.podman.socket"];
        else
            argv = ["systemctl", "start", "io.podman.socket"];

        cockpit.spawn(argv, { superuser: "require", err: "message" })
                .then(() => this.init(true))
                .catch(err => {
                    this.setState({
                        systemServiceAvailable: false,
                        systemContainersLoaded: true,
                        systemImagesLoaded: true
                    });
                    console.warn("Failed to start system io.podman.socket:", JSON.stringify(err));
                });

        if (this.state.enableService)
            argv = ["systemctl", "--user", "enable", "--now", "io.podman.socket"];
        else
            argv = ["systemctl", "--user", "start", "io.podman.socket"];

        cockpit.spawn(argv, { err: "message" })
                .then(() => this.init(false))
                .catch(err => {
                    this.setState({
                        userServiceAvailable: false,
                        userContainersLoaded: true,
                        userImagesLoaded: true
                    });
                    console.warn("Failed to start user io.podman.socket:", JSON.stringify(err));
                });
    }

    showAll() {
        this.setState({ onlyShowRunning: false });
    }

    goToServicePage(e) {
        if (!e || e.button !== 0)
            return;
        cockpit.jump("/system/services#/io.podman.socket");
    }

    render() {
        if (this.state.systemServiceAvailable === null || this.state.userServiceAvailable === null) // not detected yet
            return null;

        if (!this.state.systemServiceAvailable && !this.state.userServiceAvailable) {
            return (
                <div className="curtains-ct blank-slate-pf">
                    <div className="blank-slate-pf-icon">
                        <span className="fa fa-exclamation-circle" />
                    </div>
                    <h1 className="header" id="slate-header">
                        { _("Podman Service is Not Active") }
                    </h1>
                    <div className="checkbox">
                        <label>
                            <input type="checkbox"
                                   checked={this.state.enableService}
                                   onChange={ e => this.setState({ enableService: e.target.checked }) } />
                            {_("Automatically start podman on boot")}
                        </label>
                    </div>

                    <div className="blank-slate-pf-main-action">
                        <button className="btn btn-primary btn-lg"
                                onClick={this.startService}>
                            {_("Start podman")}
                        </button>
                    </div>
                    <div className="blank-slate-pf-secondary-action">
                        <button className="btn btn-default"
                                onClick={this.goToServicePage}>
                            {_("Troubleshoot")}
                        </button>
                    </div>
                </div>);
        }

        let imageContainerList = {};
        if (this.state.containers !== null) {
            Object.keys(this.state.containers).forEach(c => {
                const container = this.state.containers[c];
                const image = container.imageid + container.isSystem.toString();
                if (imageContainerList[image]) {
                    imageContainerList[image].push({
                        container: container,
                        stats: this.state.containersStats[container.id + container.isSystem.toString()],
                    });
                } else {
                    imageContainerList[image] = [{
                        container: container,
                        stats: this.state.containersStats[container.id + container.isSystem.toString()]
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
        if (!this.state.systemServiceAvailable && permission.allowed) {
            startService = <Alert variant='default'
                title={_("System Podman service is also available")}
                action={action} />;
        }
        if (!this.state.userServiceAvailable && this.state.userServiceExists) {
            startService = <Alert variant='default'
                title={_("User Podman service is also available")}
                action={action} />;
        }

        const imageList =
            <Images
                key="imageList"
                images={this.state.systemImagesLoaded && this.state.userImagesLoaded ? this.state.images : null}
                imageContainerList={imageContainerList}
                onAddNotification={this.onAddNotification}
                textFilter={this.state.textFilter}
                showAll={this.showAll}
                user={permission.user || _("user")}
                userServiceAvailable={this.state.userServiceAvailable}
                systemServiceAvailable={this.state.systemServiceAvailable}
            />;
        const containerList =
            <Containers
                key="containerList"
                version={this.state.version}
                containers={this.state.systemContainersLoaded && this.state.userContainersLoaded ? this.state.containers : null}
                containersStats={this.state.containersStats}
                onlyShowRunning={this.state.onlyShowRunning}
                textFilter={this.state.textFilter}
                user={permission.user || _("user")}
                onAddNotification={this.onAddNotification}
            />;
        const notificationList = (
            <section className='toast-notification-wrapper'>
                <ToastNotificationList>
                    {this.state.notifications.map((notification, index) => {
                        return (
                            <Alert key={index} title={notification.error} variant={notification.type}
                                   action={<AlertActionCloseButton onClose={() => this.onDismissNotification(notification.index)} />}>
                                {notification.errorDetail}
                            </Alert>
                        );
                    })}
                </ToastNotificationList>
            </section>
        );

        return (
            <div id="overview" key="overview">
                {notificationList}
                <div key="containerheader" className="content-filter">
                    <ContainerHeader
                        onlyShowRunning={this.state.onlyShowRunning}
                        onChange={this.onChange}
                        onFilterChanged={this.onFilterChanged}
                    />
                </div>
                <div className="container-fluid">
                    { this.state.showStartService ? startService : null }
                </div>
                <div key="containerslists" className="container-fluid">
                    {containerList}
                </div>
                <div key="imageslists" className="container-fluid">
                    {imageList}
                </div>
            </div>
        );
    }
}

export default Application;
