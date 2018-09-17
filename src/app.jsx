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

import cockpit from 'cockpit';
import React from 'react';
import ContainerHeader from './ContainerHeader.jsx';
import Containers from './Containers.jsx';
import Images from './Images.jsx';
import * as utils from './util.js';

const _ = cockpit.gettext;

class Application extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            version: { version: "unknown" },
            images: [], /* detail info of each image from InspectImage */
            containers: [], /* detail info of each container from InspectContainer */
            containersStats:[], /* memory usage of running containers */
            onlyShowRunning: true,
            dropDownValue: 'Everything',
        };
        this.onChange = this.onChange.bind(this);
        this.updateContainers = this.updateContainers.bind(this);
        this.updateImages = this.updateImages.bind(this);
        this.updateContainersAfterEvent = this.updateContainersAfterEvent.bind(this);
        this.updateImagesAfterEvent = this.updateImagesAfterEvent.bind(this);
    }

    onChange(value) {
        this.setState({
            onlyShowRunning: value != "all"
        });
    }

    updateContainers(newContainers) {
        this.setState({
            containers: newContainers
        });
    }

    updateImages(newImages) {
        this.setState({
            images: newImages
        });
    }

    updateContainerStats (newContainerStats) {
        this.setState({
            containersStats: newContainerStats
        });
    }

    updateContainersAfterEvent() {
        utils.updateContainers()
                .then((reply) => {
                    this.updateContainers(reply.newContainers);
                    this.updateContainerStats(reply.newContainerStats);
                    document.body.classList.remove('busy-cursor');
                })
                .catch(ex => {
                    console.error("Failed to do Update Container:", JSON.stringify(ex));
                    document.body.classList.remove('busy-cursor');
                });
    }

    updateImagesAfterEvent() {
        utils.updateImages()
                .then((reply) => {
                    this.updateImages(reply);
                })
                .catch(ex => {
                    console.error("Failed to Update Image:", JSON.stringify(ex));
                });
    }

    componentDidMount() {
        this._asyncRequestVersion = utils.varlinkCall(utils.PODMAN, "io.podman.GetVersion")
                .then(reply => {
                    this._asyncRequestVersion = null;
                    this.setState({ version: reply.version });
                })
                .catch(ex => console.error("Failed to do GetVersion call:", JSON.stringify(ex)));

        this._asyncRequestImages = utils.varlinkCall(utils.PODMAN, "io.podman.ListImages")
                .then(reply => {
                    this._asyncRequestImages = null;
                    let imagesMeta = reply.images || [];
                    imagesMeta.map((img) => {
                        utils.varlinkCall(utils.PODMAN, "io.podman.InspectImage", {name: img.id})
                                .then(reply => {
                                    let temp_imgs = [];
                                    Object.keys(this.state.images).filter(id => { temp_imgs[id] = this.state.images[id] });
                                    temp_imgs[img.id] = JSON.parse(reply.image);
                                    this.setState({images: temp_imgs});
                                })
                                .catch(ex => console.error("Failed to do InspectImage call:", ex, JSON.stringify(ex)));
                    });
                })
                .catch(ex => console.error("Failed to do ListImages call:", ex, JSON.stringify(ex)));

        this._asyncRequestContainers = utils.varlinkCall(utils.PODMAN, "io.podman.ListContainers")
                .then(reply => {
                    this._asyncRequestContainers = null;
                    let containersMeta = reply.containers || [];
                    containersMeta.map((container) => {
                        utils.varlinkCall(utils.PODMAN, "io.podman.InspectContainer", {name: container.id})
                                .then(reply => {
                                    let temp_containers = [];
                                    Object.keys(this.state.containers).filter(id => { temp_containers[id] = this.state.containers[id] });
                                    temp_containers[container.id] = JSON.parse(reply.container);
                                    this.setState({containers: temp_containers});
                                })
                                .catch(ex => console.error("Failed to do InspectContainer call:", ex, JSON.stringify(ex)));
                    });
                    containersMeta.filter((ele) => {
                        return ele.status === "running";
                    }).map((container) => {
                        utils.varlinkCall(utils.PODMAN, "io.podman.GetContainerStats", {name: container.id})
                                .then(reply => {
                                    let temp_container_stats = [];
                                    Object.keys(this.state.containersStats).filter(id => { temp_container_stats[id] = this.state.containersStats[id] });
                                    temp_container_stats[container.id] = reply.container;
                                    this.setState({containersStats: temp_container_stats});
                                })
                                .catch(ex => console.error("Failed to do GetContainerStats call:", ex, JSON.stringify(ex)));
                    });
                })
                .catch(ex => console.error("Failed to do ListContainers call:", JSON.stringify(ex), ex.toString()));
        this.setState({
            containers:[],
            containersStats:[]
        });
    }

    componentWillUnmount() {
        if (this._asyncRequestVersion) {
            this._asyncRequestVersion.cancel();
        }
        if (this._asyncRequestImages) {
            this._asyncRequestImages.cancel();
        }
        if (this._asyncRequestContainers) {
            this._asyncRequestContainers.cancel();
        }
    }

    render() {
        let imageList;
        let containerList;
        const imgprops = {
            key: _("imageList"),
            images: this.state.images,
            updateContainersAfterEvent: this.updateContainersAfterEvent,
            updateImagesAfterEvent: this.updateImagesAfterEvent
        };
        const ctrprops = {key:_("containerList"),
                          containers: this.state.containers,
                          containersStats: this.state.containersStats,
                          onlyShowRunning: this.state.onlyShowRunning,
                          updateContainersAfterEvent: this.updateContainersAfterEvent
        };
        imageList =
            <Images
                {...imgprops}
            />;
        containerList =
            <Containers
                {...ctrprops}
            />;

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
            </div>
        );
    }
}

export default Application;
