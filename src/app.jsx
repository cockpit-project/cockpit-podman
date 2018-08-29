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
            images: [],
            containers: [],
            imagesMeta: [],
            containersMeta: [],
            containersStats:[],
            onlyShowRunning: true,
            dropDownValue: 'Everything',
        };
        this.onChange = this.onChange.bind(this);
        this.updateContainers = this.updateContainers.bind(this);
        this.updateImages = this.updateImages.bind(this);
        this.updateContainerStats = this.updateContainerStats.bind(this);
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
                    this.setState({ imagesMeta: reply.images });
                    this.state.imagesMeta.map((img) => {
                        utils.varlinkCall(utils.PODMAN, "io.podman.InspectImage", {name: img.id})

                                .then(reply => {
                                    const temp_imgs = this.state.images;
                                    temp_imgs.push(JSON.parse(reply.image));
                                    this.setState({images: temp_imgs});
                                })
                                .catch(ex => console.error("Failed to do InspectImage call:", ex, JSON.stringify(ex)));
                    });
                })
                .catch(ex => console.error("Failed to do ListImages call:", ex, JSON.stringify(ex)));

        this._asyncRequestContainers = utils.varlinkCall(utils.PODMAN, "io.podman.ListContainers")
                .then(reply => {
                    this._asyncRequestContainers = null;
                    this.setState({containersMeta: reply.containers || []});
                    this.state.containersMeta.map((container) => {
                        utils.varlinkCall(utils.PODMAN, "io.podman.InspectContainer", {name: container.id})

                                .then(reply => {
                                    let temp_containers = this.state.containers;
                                    temp_containers.push(JSON.parse(reply.container));
                                    this.setState({containers: temp_containers});
                                })
                                .catch(ex => console.error("Failed to do InspectContainer call:", ex, JSON.stringify(ex)));
                    });
                    this.state.containersMeta.filter((ele) => {
                        if (ele.status === "running") {
                            return true;
                        } else {
                            return false;
                        }
                    }).map((container) => {
                        utils.varlinkCall(utils.PODMAN, "io.podman.GetContainerStats", {name: container.id})
                                .then(reply => {
                                    let temp_container_stats = this.state.containersStats;
                                    if (reply.container) {
                                        temp_container_stats[container.id] = reply.container;
                                    }
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
            updateImages: this.updateImages,
            updateContainers: this.updateContainers
        };
        const ctrprops = {key:_("containerList"),
                          containers: this.state.containers,
                          containersStats: this.state.containersStats,
                          onlyShowRunning: this.state.onlyShowRunning,
                          updateContainers: this.updateContainers,
                          updateContainerStats: this.updateContainerStats
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
