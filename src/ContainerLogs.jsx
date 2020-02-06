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

import * as utils from './util.js';
import varlink from './varlink.js';
import cockpit from 'cockpit';

import "./ContainerTerminal.css";

const _ = cockpit.gettext;

class ContainerLogs extends React.Component {
    constructor(props) {
        super(props);

        this.onStreamClose = this.onStreamClose.bind(this);
        this.onStreamMessage = this.onStreamMessage.bind(this);
        this.connectStream = this.connectStream.bind(this);

        const view = new Terminal({
            cols: 80,
            rows: 24,
            convertEol: true,
            cursorBlink: false,
            disableStdin: true,
            fontSize: 12,
            fontFamily: 'Menlo, Monaco, Consolas, monospace',
            screenReaderMode: true
        });
        view._core.cursorHidden = true;
        view.write(_("Loading logs..."));

        this.state = {
            view: view,
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
        if (prevProps.width !== this.props.width) {
            this.resize(this.props.width);
        }
    }

    resize(width) {
        var padding = 11 + 5 + 50;
        var realWidth = this.state.view._core._renderCoordinator.dimensions.actualCellWidth;
        var cols = Math.floor((width - padding) / realWidth);
        this.state.view.resize(cols, 24);
    }

    componentWillUnmount() {
        this._ismounted = false;
        if (this.state.streamer)
            this.state.streamer.close();
        this.state.view.destroy();
    }

    connectStream() {
        if (this.state.streamer !== null)
            return;

        // Show the terminal. Once it was shown, do not show it again but reuse the previous one
        if (!this.state.opened) {
            this.state.view.open(this.refs.logs);
            this.setState({ opened: true });
        }
        this.resize(this.props.width);

        const logsData = {};
        logsData.name = this.props.containerId;

        varlink.connect(utils.getAddress(this.props.system), this.props.system)
                .then(connection => {
                    connection.monitor("io.podman.GetContainerLogs", logsData, this.onStreamMessage)
                            .then(this.onStreamClose)
                            .catch(e => {
                                if (e.error === "ConnectionClosed")
                                    this.onStreamClose();
                                else
                                    this.setState({
                                        errorMessage: e.message,
                                        streamer: null,
                                    });
                            });
                    this.setState({
                        streamer: connection,
                        errorMessage: "",
                    });
                })
                .catch(e => {
                    this.setState({
                        errorMessage: e.message,
                        streamer: null,
                    });
                });
    }

    onStreamMessage(data) {
        // data = {parameters: {container: [<data_string>]}}
        // Example <data_string>="2020-01-23T09:34:34.563845178+01:00 stdout F 19\r\n"
        if (data && data.parameters) {
            const just_logs = data.parameters.container.map(e => e.split(" ").slice(3)
                    .join(" "));
            if (this.state.loading) {
                this.state.view.reset();
                this.state.view._core.cursorHidden = true;
                this.setState({ loading: false });
            }
            this.state.view.write(just_logs.join(""));
        }
    }

    onStreamClose() {
        if (this._ismounted) {
            this.setState({
                streamer: null,
            });
            this.state.view.write("Streaming disconnected");
        }
    }

    render() {
        let element = <div className="container-logs" ref="logs" />;
        if (this.state.errorMessage)
            element = (<div ref="logs" className="empty-state">
                <span className="empty-message">
                    { this.state.errorMessage }
                </span>
            </div>
            );

        return element;
    }
}

ContainerLogs.propTypes = {
    containerId: PropTypes.string.isRequired,
    system: PropTypes.bool.isRequired,
    width: PropTypes.number.isRequired
};

export default ContainerLogs;
