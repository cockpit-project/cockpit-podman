/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2019 Red Hat, Inc.
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
import cockpit from 'cockpit';
import { Terminal } from "xterm";

import * as utils from './util.js';

import "./ContainerTerminal.css";

const _ = cockpit.gettext;

class ContainerTerminal extends React.Component {
    constructor(props) {
        super(props);

        this.onChannelClose = this.onChannelClose.bind(this);
        this.onChannelMessage = this.onChannelMessage.bind(this);
        this.disconnectChannel = this.disconnectChannel.bind(this);
        this.connectChannel = this.connectChannel.bind(this);
        this.resize = this.resize.bind(this);

        let term = new Terminal({
            cols: 80,
            rows: 24,
            screenKeys: true,
            cursorBlink: true,
            fontSize: 12,
            fontFamily: 'Menlo, Monaco, Consolas, monospace',
            screenReaderMode: true
        });

        this.state = {
            term: term,
            container: props.containerId,
            channel: null,
            control_channel: null,
            opened: false,
            errorMessage: "",
            cols: 80,
        };
    }

    componentDidMount() {
        this.connectChannel();
    }

    componentDidUpdate(prevProps, prevState) {
        if (!this.state.channel && this.props.containerStatus === "running" && prevProps.containerStatus !== "running")
            this.connectChannel();
        if (prevProps.width !== this.props.width) {
            this.resize(this.props.width);
        }
    }

    resize(width) {
        var padding = 11 + 5 + 50;
        var realWidth = this.state.term._core._renderCoordinator.dimensions.actualCellWidth;
        var cols = Math.floor((width - padding) / realWidth);
        this.state.term.resize(cols, 24);
        cockpit.spawn(["sh", "-c", "echo '1 24 " + cols.toString() + "'>" + this.state.control_channel], { superuser: true });
        this.setState({ cols: cols });
    }

    connectChannel() {
        let self = this;
        if (self.state.channel)
            return;

        if (self.props.containerStatus !== "running") {
            let message = _("Container is not running");
            this.setState({ errorMessage: message });
            return;
        }

        utils.podmanCall("GetAttachSockets", { name: this.state.container })
                .then(out => {
                    let opts = {
                        payload: "packet",
                        unix: out.sockets.io_socket,
                        superuser: "require",
                        binary: false
                    };

                    let channel = cockpit.channel(opts);
                    channel.wait()
                            .then(() => {
                                // Show the terminal. Once it was shown, do not show it again but reuse the previous one
                                if (!this.state.opened) {
                                    this.state.term.open(this.refs.terminal);
                                    this.setState({ opened: true });

                                    self.state.term.on('data', function(data) {
                                        if (self.state.channel)
                                            self.state.channel.send(data);
                                    });
                                }

                                channel.addEventListener("message", this.onChannelMessage);
                                channel.addEventListener('close', this.onChannelClose);

                                channel.send(String.fromCharCode(12)); // Send SIGWINCH to show prompt on attaching
                                this.setState({ channel: channel, control_channel: out.sockets.control_socket, errorMessage: "" });
                                this.resize(this.props.width);
                            })
                            .catch(e => {
                                let message = cockpit.format(_("Could not open channel: $0"), e.problem);
                                if (e.problem === "not-supported")
                                    message = _("This version of the Web Console does not support a terminal.");
                                this.setState({ errorMessage: message });
                            });
                })
                .catch(e => this.setState({ errorMessage: cockpit.format(_("Could not attach to this container: $0"), e.problem) }));
    }

    componentWillUnmount() {
        this.disconnectChannel();
        if (this.state.channel)
            this.state.channel.close();
        this.state.term.destroy();
    }

    onChannelMessage(event, data) {
        this.state.term.write(data.substring(1)); // Drop first character which is marking stdin/stdout/stderr
    }

    onChannelClose(event, options) {
        var term = this.state.term;
        term.write('\x1b[31m disconnected \x1b[m\r\n');
        this.disconnectChannel();
        this.setState({ channel: null });
        term.cursorHidden = true;
    }

    disconnectChannel() {
        if (this.state.channel) {
            this.state.channel.removeEventListener('message', this.onChannelMessage);
            this.state.channel.removeEventListener('close', this.onChannelClose);
        }
    }

    render() {
        let element = <div ref="terminal" />;
        if (this.state.errorMessage)
            element = (<div ref="terminal" className="empty-state">
                <span className="empty-message">
                    { this.state.errorMessage }
                </span>
            </div>
            );

        return (
            <React.Fragment>
                { element }
            </React.Fragment>
        );
    }
}

ContainerTerminal.propTypes = {
    containerId: PropTypes.string.isRequired,
    containerStatus: PropTypes.string.isRequired
};

export default ContainerTerminal;
