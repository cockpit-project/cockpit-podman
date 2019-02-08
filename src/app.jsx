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
            dropDownValue: 'Everything',
            notifications: [],
        };
        this.onAddNotification = this.onAddNotification.bind(this);
        this.onDismissNotification = this.onDismissNotification.bind(this);
        this.onChange = this.onChange.bind(this);
        this.updateContainersAfterEvent = this.updateContainersAfterEvent.bind(this);
        this.updateImagesAfterEvent = this.updateImagesAfterEvent.bind(this);
        this.startService = this.startService.bind(this);
        this.goToServicePage = this.goToServicePage.bind(this);
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

    updateContainersAfterEvent() {
        utils.updateContainers()
                .then((reply) => {
                    this.setState({
                        containers: reply.newContainers,
                        containersStats: reply.newContainersStats
                    });
                })
                .catch(ex => {
                    console.error("Failed to do Update Container:", JSON.stringify(ex));
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

    init() {
        varlink.call(utils.PODMAN_ADDRESS, "io.podman.GetVersion")
                .then(reply => {
                    this.setState({ serviceAvailable: true });
                    this.updateImagesAfterEvent();
                    this.updateContainersAfterEvent();
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
                updateContainersAfterEvent={this.updateContainersAfterEvent}
                updateImagesAfterEvent={this.updateImagesAfterEvent}
                onAddNotification={this.onAddNotification}
            />;
        containerList =
            <Containers
                key={_("containerList")}
                containers={this.state.containers}
                containersStats={this.state.containersStats}
                onlyShowRunning={this.state.onlyShowRunning}
                updateContainersAfterEvent={this.updateContainersAfterEvent}
                updateImagesAfterEvent={this.updateImagesAfterEvent}
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
