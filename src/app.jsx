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
import varlink from './varlink';

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
        };
        this.onChange = this.onChange.bind(this);
        this.updateContainersAfterEvent = this.updateContainersAfterEvent.bind(this);
        this.updateImagesAfterEvent = this.updateImagesAfterEvent.bind(this);
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

    componentDidMount() {
        varlink.call(utils.PODMAN_ADDRESS, "io.podman.GetVersion")
                .then(reply => {
                    this.setState({ version: reply.version });
                })
                .catch(ex => console.error("Failed to do GetVersion call:", JSON.stringify(ex)));

        this.updateImagesAfterEvent();
        this.updateContainersAfterEvent();
    }

    render() {
        let imageList;
        let containerList;
        imageList =
            <Images
                key={_("imageList")}
                images={this.state.images}
                updateContainersAfterEvent={this.updateContainersAfterEvent}
                updateImagesAfterEvent={this.updateImagesAfterEvent}
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
