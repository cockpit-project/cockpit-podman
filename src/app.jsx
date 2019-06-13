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
import { ToastNotificationList, ToastNotification } from 'patternfly-react';

import cockpit from 'cockpit';
import ContainerHeader from './ContainerHeader.jsx';
import Containers from './Containers.jsx';
import Images from './Images.jsx';
import * as utils from './util.js';
import varlink from './varlink';

const _ = cockpit.gettext;

class Application extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            serviceAvailable: null,
            enableService: true,
            images: {}, /* images[Id]: detail info of image with Id from InspectImage */
            containers: {}, /* containers[Id] detail info of container with Id from InspectContainer */
            containersStats:{}, /* containersStats[Id] memory usage of running container with Id */
            onlyShowRunning: true,
            textFilter: "",
            dropDownValue: 'Everything',
            notifications: [],
            version: '1.2.0'
        };
        this.onAddNotification = this.onAddNotification.bind(this);
        this.onDismissNotification = this.onDismissNotification.bind(this);
        this.onChange = this.onChange.bind(this);
        this.onFilterChanged = this.onFilterChanged.bind(this);
        this.updateImagesAfterEvent = this.updateImagesAfterEvent.bind(this);
        this.updateContainerAfterEvent = this.updateContainerAfterEvent.bind(this);
        this.startService = this.startService.bind(this);
        this.goToServicePage = this.goToServicePage.bind(this);
        this.handleImageEvent = this.handleImageEvent.bind(this);
        this.handleContainerEvent = this.handleContainerEvent.bind(this);
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
        let notificationsArray = this.state.notifications.concat();
        let index = notificationsArray.findIndex(current => current.index == notificationIndex);

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

    updateContainersAfterEvent() {
        utils.updateContainers()
                .then((reply) => {
                    this.setState({
                        containers: reply.newContainers,
                        containersStats: reply.newContainersStats
                    });
                })
                .catch(ex => {
                    console.warn("Failed to do Update Container:", JSON.stringify(ex));
                });
    }

    updateImagesAfterEvent() {
        utils.updateImages()
                .then(reply => {
                    this.setState({
                        images: reply
                    });
                });
    }

    updateContainerAfterEvent(id) {
        utils.updateContainer(id)
                .then(reply => {
                    this.setState(prevState => {
                        let containersCopy = Object.assign({}, prevState.containers);
                        let containersCopyStats = Object.assign({}, prevState.containersStats);

                        containersCopy[reply.container.id] = reply.container;
                        containersCopyStats[reply.container.id] = reply.containerStats;

                        return {
                            containers: containersCopy,
                            containersStats: containersCopyStats,
                        };
                    });
                })
                .catch(ex => {
                    console.warn("Failed to do Update Container:", JSON.stringify(ex));
                });
    }

    handleImageEvent(event) {
        switch (event.status) {
        case 'prune':
        case 'pull':
        case 'push':
        case 'remove':
        case 'save':
        case 'tag':
        case 'untag':
            this.updateImagesAfterEvent();
            break;
        default:
            console.warn('Unhandled event type ', event.type, event.status);
        }
    }

    handleContainerEvent(event) {
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
            this.updateContainerAfterEvent(event.id);
            break;
        case 'remove':
        case 'cleanup':
            this.updateContainersAfterEvent();
            break;
        /* The following events need only to update the Image list */
        case 'commit':
            this.updateImagesAfterEvent();
            break;
        default:
            console.warn('Unhandled event type ', event.type, event.status);
        }
    }

    handleEvent(event) {
        switch (event.type) {
        case 'container':
            this.handleContainerEvent(event);
            break;
        case 'image':
            this.handleImageEvent(event);
            break;
        default:
            console.warn('Unhandled event type ', event.type);
        }
    }

    init() {
        varlink.call(utils.PODMAN_ADDRESS, "io.podman.GetVersion")
                .then(reply => {
                    this.setState({ serviceAvailable: true, version: reply.version });
                    this.updateImagesAfterEvent();
                    this.updateContainersAfterEvent();

                    return varlink.connect(utils.PODMAN_ADDRESS);
                })
                .then(connection => {
                    return connection.monitor(
                        "io.podman.GetEvents", {},
                        message => { message.parameters && message.parameters.events && this.handleEvent(message.parameters.events) }
                    );
                })
                .catch(error => {
                    if (error.name === "ConnectionClosed")
                        this.setState({ serviceAvailable: false });
                    else
                        console.error("Failed to call GetVersion():", error);
                });
    }

    componentDidMount() {
        this.init();
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
                .then(() => this.init())
                .catch(err => console.error("Failed to start io.podman.socket:", JSON.stringify(err)));
    }

    goToServicePage(e) {
        if (!e || e.button !== 0)
            return;
        cockpit.jump("/system/services#/io.podman.socket");
    }

    render() {
        if (this.state.serviceAvailable === null) // not detected yet
            return null;

        if (!this.state.serviceAvailable) {
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

        let imageList;
        let containerList;
        imageList =
            <Images
                key={_("imageList")}
                images={this.state.images}
                version={this.state.version}
                onAddNotification={this.onAddNotification}
                textFilter={this.state.textFilter}
            />;
        containerList =
            <Containers
                key={_("containerList")}
                containers={this.state.containers}
                containersStats={this.state.containersStats}
                onlyShowRunning={this.state.onlyShowRunning}
                textFilter={this.state.textFilter}
            />;
        const notificationList = (
            <ToastNotificationList>
                {this.state.notifications.map((notification, index) => {
                    return (
                        <ToastNotification key={index} type={notification.type}
                                           onDismiss={() => this.onDismissNotification(notification.index)}>
                            {notification.children}
                        </ToastNotification>
                    );
                })}
            </ToastNotificationList>
        );
        return (
            <div id="overview" key={"overview"}>
                <div key={"containerheader"} className="content-filter">
                    <ContainerHeader
                        onlyShowRunning={this.state.onlyShowRunning}
                        onChange={this.onChange}
                        onFilterChanged={this.onFilterChanged}
                    />
                </div>
                <div key={"containerslists"} className="container-fluid">
                    {containerList}
                </div>
                <div key={"imageslists"} className="container-fluid">
                    {imageList}
                </div>
                <div style={null}>
                    {notificationList}
                </div>
            </div>
        );
    }
}

export default Application;
