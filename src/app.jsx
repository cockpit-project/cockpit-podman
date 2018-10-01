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
            images: {}, /* images[Id]: detail info of image with Id from InspectImage */
            containers: {}, /* containers[Id] detail info of container with Id from InspectContainer */
            containersStats:{}, /* containersStats[Id] memory usage of running container with Id */
            onlyShowRunning: true,
            dropDownValue: 'Everything',
            filterText: '',
        };
        this.onChange = this.onChange.bind(this);
        this.updateContainersAfterEvent = this.updateContainersAfterEvent.bind(this);
        this.updateImagesAfterEvent = this.updateImagesAfterEvent.bind(this);
        this.filterTextChange = this.filterTextChange.bind(this);
    }

    onChange(value) {
        this.setState({
            onlyShowRunning: value != "all"
        });
    }

    filterTextChange(text) {
        this.setState({
            filterText: text
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

    componentDidMount() {
        this._asyncRequestVersion = utils.varlinkCall(utils.PODMAN, "io.podman.GetVersion")
                .then(reply => {
                    this._asyncRequestVersion = null;
                    this.setState({ version: reply.version });
                })
                .catch(ex => console.error("Failed to do GetVersion call:", JSON.stringify(ex)));

        this.updateImagesAfterEvent();
        this.updateContainersAfterEvent();
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
            filterText: this.state.filterText
        };
        const ctrprops = {
            key:_("containerList"),
            containers: this.state.containers,
            containersStats: this.state.containersStats,
            onlyShowRunning: this.state.onlyShowRunning,
            updateContainersAfterEvent: this.updateContainersAfterEvent,
            filterText: this.state.filterText
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
                        filterTextChange={this.filterTextChange}
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
