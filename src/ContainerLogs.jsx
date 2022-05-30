/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2020 Red Hat, Inc.
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
import PropTypes from 'prop-types';
import { Terminal } from "xterm";
import { ExclamationCircleIcon } from '@patternfly/react-icons';

import cockpit from 'cockpit';
import rest from './rest.js';
import * as client from './client.js';
import { EmptyStatePanel } from "cockpit-components-empty-state.jsx";

import "./ContainerTerminal.css";

const _ = cockpit.gettext;

class ContainerLogs extends React.Component {
    constructor(props) {
        super(props);

        this.onStreamClose = this.onStreamClose.bind(this);
        this.onStreamMessage = this.onStreamMessage.bind(this);
        this.connectStream = this.connectStream.bind(this);

        this.view = new Terminal({
            cols: 80,
            rows: 24,
            convertEol: true,
            cursorBlink: false,
            disableStdin: true,
            fontSize: 12,
            fontFamily: 'Menlo, Monaco, Consolas, monospace',
            screenReaderMode: true
        });
        this.view._core.cursorHidden = true;
        this.view.write(_("Loading logs..."));

        this.logRef = React.createRef();

        this.state = {
            opened: false,
            loading: true,
            errorMessage: "",
            streamer: null,
        };
    }

    componentDidMount() {
        this._ismounted = true;
        this.connectStream();
    }

    componentDidUpdate(prevProps, prevState) {
        // Connect channel when there is none and container started
        if (!this.state.streamer && this.props.containerStatus === "running" && prevProps.containerStatus !== "running")
            this.connectStream();
        if (prevProps.width !== this.props.width) {
            this.resize(this.props.width);
        }
    }

    resize(width) {
        // 24 PF padding * 4
        // 3 line border
        // 21 inner padding of xterm.js
        // xterm.js scrollbar 20
        const padding = 24 * 4 + 3 + 21 + 20;
        const realWidth = this.view._core._renderService.dimensions.actualCellWidth;
        const cols = Math.floor((width - padding) / realWidth);
        this.view.resize(cols, 24);
    }

    componentWillUnmount() {
        this._ismounted = false;
        if (this.state.streamer)
            this.state.streamer.close();
        this.view.dispose();
    }

    connectStream() {
        if (this.state.streamer !== null)
            return;

        // Show the terminal. Once it was shown, do not show it again but reuse the previous one
        if (!this.state.opened) {
            this.view.open(this.logRef.current);
            this.setState({ opened: true });
        }
        this.resize(this.props.width);

        const connection = rest.connect(client.getAddress(this.props.system), this.props.system);
        const options = {
            method: "GET",
            path: client.VERSION + "libpod/containers/" + this.props.containerId + "/logs",
            body: "",
            params: {
                follow: true,
                stdout: true,
                stderr: true,
            },
        };

        connection.monitor(options, this.onStreamMessage, this.props.system, true)
                .then(this.onStreamClose)
                .catch(e => {
                    this.setState({
                        errorMessage: e.message,
                        streamer: null,
                    });
                });
        this.setState({
            streamer: connection,
            errorMessage: "",
        });
    }

    onStreamMessage(data) {
        if (data) {
            if (this.state.loading) {
                this.view.reset();
                this.view._core.cursorHidden = true;
                this.setState({ loading: false });
            }
            // First 8 bytes encode information about stream and frame
            // See 'Stream format' on https://docs.docker.com/engine/api/v1.40/#operation/ContainerAttach
            this.view.writeln(data.substring(8));
        }
    }

    onStreamClose() {
        if (this._ismounted) {
            this.setState({
                streamer: null,
            });
            this.view.write("Streaming disconnected");
        }
    }

    render() {
        let element = <div className="container-logs" ref={this.logRef} />;
        if (this.state.errorMessage)
            element = <EmptyStatePanel icon={ExclamationCircleIcon} title={this.state.errorMessage} />;

        return element;
    }
}

ContainerLogs.propTypes = {
    containerId: PropTypes.string.isRequired,
    system: PropTypes.bool.isRequired,
    width: PropTypes.number.isRequired
};

export default ContainerLogs;
