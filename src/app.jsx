/*jshint esversion: 6 */
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
import './app.scss';

import DropDownFilter from './DropDownFilter.js';
import Containers from './Containers.js';
import Images from './Images.js';
/***
 * varlink protocol helpers
 * https://github.com/varlink/varlink.github.io/wiki
 */
const encoder = cockpit.utf8_encoder();
const decoder = cockpit.utf8_decoder(true);

const PODMAN = { unix: "/run/podman/io.projectatomic.podman" };
console.log(React.version);
/**
 * Do a varlink call on an existing channel. You must *never* call this
 * multiple times in parallel on the same channel! Serialize the calls or use
 * `varlinkCall()`.
 *
 * Returns a promise that resolves with the result parameters or rejects with
 * an error message.
 */
function varlinkCallChannel(channel, method, parameters) {
    return new Promise((resolve, reject) => {
	function on_close(event, options) {
	    reject(options.problem || options);
	}

	function on_message(event, data) {
	    channel.removeEventListener("message", on_message);
	    channel.removeEventListener("close", on_close);

	    // FIXME: support answer in multiple chunks until null byte
	    if (data[data.length - 1] != 0) {
		reject("protocol error: expecting terminating 0");
		return;
	    }

	    var reply = decoder.decode(data.slice(0, -1));
	    var json = JSON.parse(reply);
	    if (json.error)
		reject(json.error)
	    else if (json.parameters) {
		// debugging
		// console.log("varlinkCall", method, "→", JSON.stringify(json.parameters));
		resolve(json.parameters)
	    } else
		reject("protocol error: reply has neither parameters nor error: " + reply);
	}

	channel.addEventListener("close", on_close);
	channel.addEventListener("message", on_message);
	channel.send(encoder.encode(JSON.stringify({ method, parameters: (parameters || {}) })));
	channel.send([0]); // message separator
    });
}

/**
 * Do a varlink call on a new channel. This is more expensive than
 * `varlinkCallChannel()` but allows multiple parallel calls.
 */
function varlinkCall(channelOptions, method, parameters) {
    var channel = cockpit.channel(Object.assign({payload: "stream", binary: true, superuser: "require" }, channelOptions));
    var response = varlinkCallChannel(channel, method, parameters);
    response.finally(() => channel.close());
    return response;
}

class Application extends React.Component {
    constructor(props) {
	super(props);

	this.state = {
	    version: { version: "unknown" },
	    images: [],
	    containers: [],
	    imagesMeta: [],
	    containersMeta: [],
	    onlyShowRunning: false,
	    dropDownValue: 'Everything',
	};
	this.handleClickEverything = this.handleClickEverything.bind(this);
	this.handleClickRunningContainers = this.handleClickRunningContainers.bind(this);
    }
    handleClickEverything(event) {
	event.preventDefault();
	// console.log("click EE");
	this.setState({
	    onlyShowRunning: false,
	    dropDownValue: event.currentTarget.textContent
	});
	// console.log(event.currentTarget.textContent)
    }

    handleClickRunningContainers(event) {
	event.preventDefault();
	this.setState({
	    onlyShowRunning: true,
	    dropDownValue: event.currentTarget.textContent
	});
    }

    componentDidMount() {
	this._asyncRequestVersion = varlinkCall(PODMAN, "io.projectatomic.podman.GetVersion")
	    .then(reply => {
		this._asyncRequestVersion = null;
		this.setState({ version: reply.version });

	    })
	    .catch(ex => console.error("Failed to do GetVersion call:", JSON.stringify(ex)));

	this._asyncRequestImages = varlinkCall(PODMAN, "io.projectatomic.podman.ListImages")
	    .then(reply => {
		this._asyncRequestImages = null;
		this.setState({ imagesMeta: reply.images });
		this.state.imagesMeta.map((img)=>{

		    varlinkCall(PODMAN, "io.projectatomic.podman.InspectImage", JSON.parse('{"name":"' + img.id + '"}'))
			.then(reply => {
			const temp_imgs = this.state.images;
			temp_imgs.push(JSON.parse(reply.image));
			this.setState({images: temp_imgs});
			})
			.catch(ex => console.error("Failed to do InspectImage call:", ex, JSON.stringify(ex)));
		})
	    })
	    .catch(ex => console.error("Failed to do ListImages call:", ex, JSON.stringify(ex)));

	this._asyncRequestContainers = varlinkCall(PODMAN, "io.projectatomic.podman.ListContainers")
	    .then(reply => {
		this._asyncRequestContainers = null;
		this.setState({containersMeta: reply.containers || []});
		// this.setState({ containers: reply.containers || [] });
		this.state.containersMeta.map((container)=> {
		    varlinkCall(PODMAN, "io.projectatomic.podman.InspectContainer", JSON.parse('{"name":"' + container.id + '"}'))
		    // console.log(container.id);
			.then(reply => {
			const temp_containers = this.state.containers;
			temp_containers.push(JSON.parse(reply.container));
			this.setState({containers: temp_containers});
			})
			.catch(ex => console.error("Failed to do InspectImage call:", ex, JSON.stringify(ex)));
		})
	    })
	    .catch(ex => console.error("Failed to do ListContainers call:", JSON.stringify(ex), ex.toString()));
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
	// console.log(this.state.containers);
	// console.log(this.state.containersMeta);
	let images = this.state.images.map(image => <li>{ image.RepoTags.join(", ") } (created: {image.Created})</li>);
	let containers = this.state.containers.map(container => <li>{container.Name} ({container.Image}): {container.Config.Cmd.join(" ")}</li> );
	let imageList;
	let containerList;
	if(this.state.images.length === 0) {
	    // console.log("loading");
	} else {
	    // console.log(this.state.images.length);
	    imageList =
		<Images
		    images={this.state.images}
		></Images>;
	    containerList=
		<Containers
		    containers={this.state.containers}
		    onlyShowRunning={this.state.onlyShowRunning}

		></Containers>
	}

	return (

	    <div className="container-fluid ">
		<DropDownFilter
		    onlyShowRunning={this.state.onlyShowRunning}
		    dropDownValue={this.state.dropDownValue}
		    handleClickEverything={this.handleClickEverything}
		    handleClickRunningContainers={this.handleClickRunningContainers}
		></DropDownFilter>
		{/* Keep initial code */}
		<div>
		    <h2>Podman Varlink Demo</h2>

		    <div>
			<span id="version">podman version: {this.state.version.version}</span>
		    </div>

		    <h3>Images</h3>
		    <ul id="images">
			{images}
		    </ul>
		    <h3>Containers</h3>
		    <ul id="containers">
			{containers}
		    </ul>
		</div>
		{/* List everything */}
		    {containerList}
		    {imageList}
	    </div>
	);
    }
}

export default Application;
