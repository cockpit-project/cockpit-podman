/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Copyright (C) 2019 Red Hat, Inc.
 */

import React from 'react';

import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal } from "@xterm/xterm";
import PropTypes from 'prop-types';

import cockpit from 'cockpit';
import { EmptyStatePanel } from "cockpit-components-empty-state.tsx";

import { ErrorNotification } from './Notification.jsx';
import * as client from './client.js';
import rest from './rest.js';

import "./ContainerTerminal.css";

const _ = cockpit.gettext;
const decoder = new TextDecoder();
const encoder = new TextEncoder();

function sequence_find(seq, find) {
    let f;
    const fl = find.length;
    let s;
    const sl = (seq.length - fl) + 1;
    for (s = 0; s < sl; s++) {
        for (f = 0; f < fl; f++) {
            if (seq[s + f] !== find[f])
                break;
        }
        if (f == fl)
            return s;
    }

    return -1;
}

class ContainerTerminal extends React.Component {
    constructor(props) {
        super(props);

        this.onChannelClose = this.onChannelClose.bind(this);
        this.onChannelMessage = this.onChannelMessage.bind(this);
        this.disconnectChannel = this.disconnectChannel.bind(this);
        this.connectChannel = this.connectChannel.bind(this);
        this.resize = this.resize.bind(this);
        this.connectToTty = this.connectToTty.bind(this);
        this.execAndConnect = this.execAndConnect.bind(this);
        this.setUpBuffer = this.setUpBuffer.bind(this);

        this.terminalRef = React.createRef();

        this.term = new Terminal({
            cols: 80,
            rows: 24,
            screenKeys: true,
            cursorBlink: true,
            fontSize: 12,
            fontFamily: 'Menlo, Monaco, Consolas, monospace',
            screenReaderMode: true
        });

        this.state = {
            container: props.containerId,
            sessionId: props.containerId,
            channel: null,
            buffer: null,
            opened: false,
            errorMessage: "",
        };
    }

    componentDidMount() {
        this.connectChannel();
    }

    componentDidUpdate(prevProps) {
        // Connect channel when there is none and either container started or tty was resolved
        if (!this.state.channel && (
            (this.props.containerStatus === "running" && prevProps.containerStatus !== "running") ||
            (this.props.tty !== undefined && prevProps.tty === undefined)))
            this.connectChannel();
        if (prevProps.width !== this.props.width) {
            this.resize(this.props.width);
        }
    }

    resize(width) {
        if (!this.term?._core?._renderService?.dimensions)
            return;
        // 24 PF padding * 4
        // 3 line border
        // 21 inner padding of xterm.js
        // xterm.js scrollbar 20
        const padding = 24 * 4 + 3 + 21 + 20;
        // missing API: https://github.com/xtermjs/xterm.js/issues/702
        const realWidth = this.term._core._renderService.dimensions.css.cell.width;
        const cols = Math.floor((width - padding) / realWidth);
        this.term.resize(cols, 24);
        client.resizeContainersTTY(this.props.con, this.state.sessionId, this.props.tty, cols, 24)
                .catch(e => this.setState({ errorMessage: e.message }));
    }

    connectChannel() {
        if (this.state.channel)
            return;

        if (this.props.containerStatus !== "running")
            return;

        if (this.props.tty === undefined)
            return;

        if (this.props.tty)
            this.connectToTty();
        else
            this.execAndConnect();
    }

    setUpBuffer(channel) {
        const buffer = channel.buffer();

        // Parse the full HTTP response
        buffer.callback = (data) => {
            let ret = 0;
            let pos = 0;

            // Double line break separates header from body
            pos = sequence_find(data, [13, 10, 13, 10]);
            if (pos == -1)
                return ret;

            const headers = decoder.decode(
                data.subarray ? data.subarray(0, pos) : data.slice(0, pos));

            const parts = headers.split("\r\n", 1)[0].split(" ");
            // Check if we got `101` as we expect `HTTP/1.1 101 UPGRADED`
            if (parts[1] != "101") {
                console.log(parts.slice(2).join(" "));
                buffer.callback = null;
                return;
            } else if (data.subarray) {
                data = data.subarray(pos + 4);
                ret += pos + 4;
            } else {
                data = data.slice(pos + 4);
                ret += pos + 4;
            }
            // Set up callback for new incoming messages and if the first response
            // contained any body, pass it into the callback
            buffer.callback = this.onChannelMessage;
            const consumed = this.onChannelMessage(data);
            return ret + consumed;
        };

        channel.addEventListener('close', this.onChannelClose);

        // Show the terminal. Once it was shown, do not show it again but reuse the previous one
        if (!this.state.opened) {
            this.term.open(this.terminalRef.current);
            this.term.loadAddon(new WebglAddon());
            this.setState({ opened: true });

            this.term.onData((data) => {
                if (this.state.channel)
                    this.state.channel.send(encoder.encode(data));
            });
        }
        channel.send(String.fromCharCode(12)); // Send SIGWINCH to show prompt on attaching

        return buffer;
    }

    execAndConnect() {
        client.execContainer(this.props.con, this.state.container)
                .then(r => {
                    const address = rest.getAddress(this.props.uid);
                    const channel = cockpit.channel({
                        payload: "stream",
                        unix: address.path,
                        superuser: address.superuser,
                        binary: true
                    });

                    const body = JSON.stringify({ Detach: false, Tty: false });
                    channel.send("POST " + client.VERSION + "libpod/exec/" + encodeURIComponent(r.Id) +
                              "/start HTTP/1.0\r\n" +
                              "Upgrade: WebSocket\r\nConnection: Upgrade\r\nContent-Length: " + body.length + "\r\n\r\n" + body);

                    const buffer = this.setUpBuffer(channel);
                    this.setState({ channel, errorMessage: "", buffer, sessionId: r.Id }, () => this.resize(this.props.width));
                })
                .catch(e => this.setState({ errorMessage: e.message }));
    }

    connectToTty() {
        const address = rest.getAddress(this.props.uid);
        const channel = cockpit.channel({
            payload: "stream",
            unix: address.path,
            superuser: address.superuser,
            binary: true
        });

        channel.send("POST " + client.VERSION + "libpod/containers/" + encodeURIComponent(this.state.container) +
                      "/attach?&stdin=true&stdout=true&stderr=true HTTP/1.0\r\n" +
                      "Upgrade: WebSocket\r\nConnection: Upgrade\r\nContent-Length: 0\r\n\r\n");

        const buffer = this.setUpBuffer(channel);
        this.setState({ channel, errorMessage: "", buffer });
        this.resize(this.props.width);
    }

    componentWillUnmount() {
        this.disconnectChannel();
        if (this.state.channel)
            this.state.channel.close();
        this.term.dispose();
    }

    onChannelMessage(buffer) {
        if (buffer)
            this.term.write(decoder.decode(buffer));
        return buffer.length;
    }

    onChannelClose() {
        this.term.write('\x1b[31m disconnected \x1b[m\r\n');
        this.disconnectChannel();
        this.setState({ channel: null });
        this.term.cursorHidden = true;
    }

    disconnectChannel() {
        if (this.state.buffer)
            this.state.buffer.callback = null; // eslint-disable-line react/no-direct-mutation-state
        if (this.state.channel) {
            this.state.channel.removeEventListener('close', this.onChannelClose);
        }
    }

    render() {
        let element = <div className="container-terminal" ref={this.terminalRef} />;

        if (this.props.containerStatus !== "running" && !this.state.opened)
            element = <EmptyStatePanel title={_("Container is not running")} />;

        return (
            <>
                {this.state.errorMessage && <ErrorNotification errorMessage={_("Error occurred while connecting console")} errorDetail={this.state.errorMessage} onDismiss={() => this.setState({ errorMessage: "" })} />}
                {element}
            </>
        );
    }
}

ContainerTerminal.propTypes = {
    con: PropTypes.object.isRequired,
    containerId: PropTypes.string.isRequired,
    containerStatus: PropTypes.string.isRequired,
    width: PropTypes.number.isRequired,
    uid: PropTypes.number,
    tty: PropTypes.bool,
};

export default ContainerTerminal;
