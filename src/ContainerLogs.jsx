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

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { CanvasAddon } from '@xterm/addon-canvas';
import { Terminal } from "@xterm/xterm";
import PropTypes from 'prop-types';

import cockpit from 'cockpit';
import { EmptyStatePanel } from "cockpit-components-empty-state.tsx";

import * as client from './client.js';
import rest from './rest.js';

import "./ContainerTerminal.css";

const _ = cockpit.gettext;

const LOGS_MAX_SIZE = 1000;

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
            screenReaderMode: true,
            scrollback: LOGS_MAX_SIZE,
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

    componentDidUpdate(prevProps) {
        // Connect channel when there is none and container started
        if (!this.state.streamer && this.props.containerStatus === "running" && prevProps.containerStatus !== "running")
            this.connectStream();
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
        const realWidth = this.view._core._renderService.dimensions.css.cell.width;
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
            this.view.loadAddon(new CanvasAddon());
            this.setState({ opened: true });
        }
        this.resize(this.props.width);

        const connection = rest.connect(this.props.uid);
        connection.monitor(client.VERSION + "libpod/containers/" + this.props.containerId +
                           `/logs?follow=true&stdout=true&stderr=true&tail=${LOGS_MAX_SIZE}`,
                           this.onStreamMessage, true)
                .then(this.onStreamClose)
                .catch(e => {
                    this.setState({
                        errorMessage: e.message ?? e.toString(),
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
            while (data.byteLength >= 8) {
                // split into frames (size is the second 32-bit word)
                const size = data[7] + data[6] * 0x100 + data[5] * 0x10000 + data[4] * 0x1000000;
                const frame = data.slice(8, 8 + size);
                // old podman versions just have CR endings, append NL then
                if (frame[size - 1] === 13)
                    this.view.writeln(frame);
                else
                    // recent podman  versions have CRNL endings
                    this.view.write(frame);
                data = data.slice(8 + size);
            }
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
        const { systemd_unit, uid } = this.props;

        if (this.state.errorMessage) {
            element = <EmptyStatePanel icon={ExclamationCircleIcon} title={this.state.errorMessage} />;
        } else if (uid === 0 && systemd_unit) {
            element = (
                <>
                    {element}
                    <Button variant="link" isInline className="pf-v6-u-mt-sm" onClick={
                        () => cockpit.jump(`/system/logs/#/?priority=info&_SYSTEMD_UNIT=${systemd_unit}`)}>
                        {cockpit.format(_("View $0 logs"), systemd_unit)}
                    </Button>
                </>
            );
        }

        return element;
    }
}

ContainerLogs.propTypes = {
    containerId: PropTypes.string.isRequired,
    uid: PropTypes.number,
    width: PropTypes.number.isRequired,
    systemd_unit: PropTypes.string
};

export default ContainerLogs;
