import React from 'react';
import ReactDOM from "react-dom";
import { Button } from '@patternfly/react-core';

import cockpit from 'cockpit';
import { ListingTable } from "../lib/cockpit-components-table.jsx";
import { ListingPanel } from '../lib/cockpit-components-listing-panel.jsx';
import ContainerDetails from './ContainerDetails.jsx';
import ContainerTerminal from './ContainerTerminal.jsx';
import ContainerLogs from './ContainerLogs.jsx';
import { DropDown } from './Dropdown.jsx';
import ContainerDeleteModal from './ContainerDeleteModal.jsx';
import ContainerCheckpointModal from './ContainerCheckpointModal.jsx';
import ContainerRestoreModal from './ContainerRestoreModal.jsx';
import ContainerRemoveErrorModal from './ContainerRemoveErrorModal.jsx';
import * as utils from './util.js';
import * as client from './client.js';
import ContainerCommitModal from './ContainerCommitModal.jsx';
import ScrollableAnchor from 'react-scrollable-anchor';

const _ = cockpit.gettext;

class Containers extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            selectContainerDeleteModal: false,
            selectContainerCheckpointModal: false,
            selectContainerRestoreModal: false,
            setContainerRemoveErrorModal: false,
            containerWillDelete: {},
            containerWillCheckpoint: {},
            containerWillRestore: {},
            checkpointInProgress: false,
            restoreInProgress: false,
            width: 0,
        };
        this.renderRow = this.renderRow.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);
        this.restartContainer = this.restartContainer.bind(this);
        this.startContainer = this.startContainer.bind(this);
        this.stopContainer = this.stopContainer.bind(this);
        this.deleteContainer = this.deleteContainer.bind(this);
        this.handleCancelContainerDeleteModal = this.handleCancelContainerDeleteModal.bind(this);
        this.handleCheckpointContainerDeleteModal = this.handleCheckpointContainerDeleteModal.bind(this);
        this.handleRestoreContainerDeleteModal = this.handleRestoreContainerDeleteModal.bind(this);
        this.handleRemoveContainer = this.handleRemoveContainer.bind(this);
        this.handleCheckpointContainer = this.handleCheckpointContainer.bind(this);
        this.handleRestoreContainer = this.handleRestoreContainer.bind(this);
        this.handleCancelRemoveError = this.handleCancelRemoveError.bind(this);
        this.handleForceRemoveContainer = this.handleForceRemoveContainer.bind(this);

        window.addEventListener('resize', this.onWindowResize);
    }

    componentDidMount() {
        this.onWindowResize();
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.onWindowResize);
    }

    deleteContainer(container, event) {
        if (container.State == "running") {
            this.setState((prevState) => ({
                containerWillDelete: container,
                setContainerRemoveErrorModal: true,
            }));
        } else {
            this.setState({
                containerWillDelete: container,
                selectContainerDeleteModal: true,
            });
        }
    }

    checkpointContainer(container) {
        this.setState({
            containerWillCheckpoint: container,
            selectContainerCheckpointModal: true,
        });
    }

    stopContainer(container, force) {
        const args = {};

        if (force)
            args.t = 0;
        client.postContainer(container.isSystem, "stop", container.Id, args)
                .catch(ex => {
                    const error = cockpit.format(_("Failed to stop container $0"), container.Names);
                    this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                });
    }

    startContainer(container) {
        client.postContainer(container.isSystem, "start", container.Id, {})
                .catch(ex => {
                    const error = cockpit.format(_("Failed to start container $0"), container.Names);
                    this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                });
    }

    restartContainer (container, force) {
        const args = {};

        if (force)
            args.t = 0;
        client.postContainer(container.isSystem, "restart", container.Id, args)
                .catch(ex => {
                    const error = cockpit.format(_("Failed to restart container $0"), container.Names);
                    this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                });
    }

    restoreContainer(container) {
        this.setState({
            containerWillRestore: container,
            selectContainerRestoreModal: true,
        });
    }

    renderRow(containersStats, container, containerDetail) {
        const containerStats = containersStats[container.Id + container.isSystem.toString()];
        const isRunning = container.State == "running";
        const image = container.Image;

        let proc = "";
        let mem = "";
        if (containerStats) {
            proc = containerStats.cpu_stats ? containerStats.cpu_stats.cpu.toFixed(2) + "%" : <div><abbr title={_("not available")}>{_("n/a")}</abbr></div>;
            mem = containerStats.memory_stats ? utils.format_memory_and_limit(containerStats.memory_stats.usage, containerStats.memory_stats.limit) : <div><abbr title={_("not available")}>{_("n/a")}</abbr></div>;
        }
        const info_block =
            <div className="container-block">
                <span className="container-name">{container.Names}</span>
                <small>{image}</small>
                <small>{utils.quote_cmdline(container.Command)}</small>
            </div>;

        const columns = [
            { title: info_block },
            proc,
            mem,
            container.isSystem ? _("system") : this.props.user.name,
            _(container.State), // States are defined in util.js
        ];

        const tty = containerDetail ? containerDetail.Config.Tty : false;

        const tabs = [{
            name: _("Details"),
            renderer: ContainerDetails,
            data: { container: container, containerDetail: containerDetail }
        }, {
            name: _("Logs"),
            renderer: ContainerLogs,
            data: { containerId: container.Id, width:this.state.width, system:container.isSystem }
        }, {
            name: _("Console"),
            renderer: ContainerTerminal,
            data: { containerId: container.Id, containerStatus: container.State, width:this.state.width, system:container.isSystem, tty: tty }
        }];

        var actions = [
            <Button
                key={container.Id + "delete"}
                variant="danger"
                className="btn-delete"
                aria-label={_("Delete image")}
                onClick={(event) => this.deleteContainer(container, event)}>
                <span className="pficon pficon-delete" />
            </Button>,
            <Button
                key={container.Id + "commit"}
                variant="secondary"
                className="btn-commit"
                data-container-id={container.Id}
                data-toggle="modal" data-target="#container-commit-dialog"
                onClick={() => this.setState({ showCommitModal: true, containerWillCommit: container })}
            >
                {_("Commit")}
            </Button>,
        ];
        if (!isRunning) {
            if (container.isSystem && container.hasCheckpoint) {
                const runActions = [];
                runActions.push({ label: _("Start"), onActivate: () => this.startContainer(container) });
                runActions.push({ label: _("Restore"), onActivate: () => this.restoreContainer(container) });
                actions.push(<DropDown key={_(container.Id) + "stop"} actions={runActions} />);
            } else {
                actions.push(
                    <Button key={container.Id + "start"} variant="secondary" onClick={() => this.startContainer(container)}>
                        {_("Start")}
                    </Button>
                );
            }
        } else {
            const restartActions = [];
            const stopActions = [];

            restartActions.push({ label: _("Restart"), onActivate: () => this.restartContainer(container) });
            restartActions.push({ label: _("Force Restart"), onActivate: () => this.restartContainer(container, true) });
            actions.push(<DropDown key={_(container.Id) + "restart"} actions={restartActions} />);

            stopActions.push({ label: _("Stop"), onActivate: () => this.stopContainer(container) });
            stopActions.push({ label: _("Force Stop"), onActivate: () => this.stopContainer(container, true) });
            if (container.isSystem)
                stopActions.push({ label: _("Checkpoint"), onActivate: () => this.checkpointContainer(container) });
            actions.push(<DropDown key={_(container.Id) + "stop"} actions={stopActions} />);
        }

        return {
            expandedContent: <ScrollableAnchor id={container.Id} key={container.Id}>
                <ListingPanel
                                    colSpan='4'
                                    listingActions={actions}
                                    tabRenderers={tabs} />
            </ScrollableAnchor>,
            columns: columns,
            initiallyExpanded: document.location.hash.substr(1) === container.Id,
            rowId: container.Id + container.isSystem.toString(),
            props: { key :container.Id + container.isSystem.toString() },
        };
    }

    handleCancelContainerDeleteModal() {
        this.setState((prevState) => ({
            selectContainerDeleteModal: !prevState.selectContainerDeleteModal,
        }));
    }

    handleRemoveContainer() {
        const id = this.state.containerWillDelete ? this.state.containerWillDelete.Id : "";
        this.setState({
            selectContainerDeleteModal: false
        });
        client.delContainer(this.state.containerWillDelete.isSystem, id, false)
                .catch(ex => {
                    const error = cockpit.format(_("Failed to remove container $0"), this.state.containerWillDelete.names);
                    this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                });
    }

    handleCheckpointContainer(args) {
        const container = this.state.containerWillCheckpoint;
        this.setState({ checkpointInProgress: true });
        client.postContainer(container.isSystem, "checkpoint", container.Id, args)
                .catch(ex => {
                    const error = cockpit.format(_("Failed to checkpoint container $0"), container.Names);
                    this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                })
                .finally(() => {
                    this.setState({
                        checkpointInProgress: false,
                        selectContainerCheckpointModal: false
                    });
                });
    }

    handleRestoreContainer(args) {
        const container = this.state.containerWillRestore;
        this.setState({ restoreInProgress: true });
        client.postContainer(container.isSystem, "restore", container.Id, args)
                .catch(ex => {
                    const error = cockpit.format(_("Failed to restore container $0"), container.Names);
                    this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                })
                .finally(() => {
                    this.setState({
                        restoreInProgress: false,
                        selectContainerRestoreModal: false
                    });
                });
    }

    handleCheckpointContainerDeleteModal() {
        this.setState((prevState) => ({
            selectContainerCheckpointModal: !prevState.selectContainerCheckpointModal,
        }));
    }

    handleRestoreContainerDeleteModal() {
        this.setState((prevState) => ({
            selectContainerRestoreModal: !prevState.selectContainerRestoreModal,
        }));
    }

    handleCancelRemoveError() {
        this.setState({
            setContainerRemoveErrorModal: false
        });
    }

    handleForceRemoveContainer() {
        const id = this.state.containerWillDelete ? this.state.containerWillDelete.Id : "";
        return client.delContainer(this.state.containerWillDelete.isSystem, id, true)
                .then(() => {
                    this.setState({
                        setContainerRemoveErrorModal: false
                    });
                }, ex => {
                    const error = cockpit.format(_("Failed to force remove container $0"), this.state.containerWillDelete.names);
                    this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                });
    }

    onWindowResize() {
        this.setState({
            width: ReactDOM.findDOMNode(this).clientWidth
        });
    }

    render() {
        const columnTitles = [_("Container"), _("CPU"), _("Memory"), _("Owner"), _("State")];

        let emptyCaption = _("No containers");
        if (this.props.containers === null)
            emptyCaption = _("Loading...");
        else if (this.props.textFilter.length > 0)
            emptyCaption = _("No containers that match the current filter");
        else if (this.props.onlyShowRunning)
            emptyCaption = _("No running containers");

        const containersStats = this.props.containersStats;
        let filtered = [];
        if (this.props.containers !== null)
            filtered = Object.keys(this.props.containers).filter(id => !this.props.onlyShowRunning || this.props.containers[id].State == "running");

        if (this.props.ownerFilter !== "all") {
            filtered = filtered.filter(id => {
                if (this.props.ownerFilter === "system" && !this.props.containers[id].isSystem)
                    return false;
                if (this.props.ownerFilter !== "system" && this.props.containers[id].isSystem)
                    return false;
                return true;
            });
        }

        if (this.props.textFilter.length > 0) {
            const lcf = this.props.textFilter.toLowerCase();
            filtered = filtered.filter(id => this.props.containers[id].Names[0].toLowerCase().indexOf(lcf) >= 0 ||
                    this.props.containers[id].Image.toLowerCase().indexOf(lcf) >= 0
            );
        }

        filtered.sort((a, b) => {
            // User containers are in front of system ones
            if (this.props.containers[a].isSystem !== this.props.containers[b].isSystem)
                return this.props.containers[a].isSystem ? 1 : -1;
            return this.props.containers[a].Names > this.props.containers[b].Names ? 1 : -1;
        });

        const rows = filtered.map(id => this.renderRow(containersStats, this.props.containers[id], this.props.containersDetails[id]));
        const containerDeleteModal =
            <ContainerDeleteModal
                selectContainerDeleteModal={this.state.selectContainerDeleteModal}
                containerWillDelete={this.state.containerWillDelete}
                handleCancelContainerDeleteModal={this.handleCancelContainerDeleteModal}
                handleRemoveContainer={this.handleRemoveContainer}
            />;
        const containerCheckpointModal =
            <ContainerCheckpointModal
                selectContainerCheckpointModal={this.state.selectContainerCheckpointModal}
                handleCheckpointContainer={this.handleCheckpointContainer}
                handleCheckpointContainerDeleteModal={this.handleCheckpointContainerDeleteModal}
                containerWillCheckpoint={this.state.containerWillCheckpoint}
                checkpointInProgress={this.state.checkpointInProgress}
            />;
        const containerRestoreModal =
            <ContainerRestoreModal
                selectContainerRestoreModal={this.state.selectContainerRestoreModal}
                handleRestoreContainer={this.handleRestoreContainer}
                handleRestoreContainerDeleteModal={this.handleRestoreContainerDeleteModal}
                containerWillCheckpoint={this.state.containerWillRestore}
                restoreInProgress={this.state.restoreInProgress}
            />;
        const containerRemoveErrorModal =
            <ContainerRemoveErrorModal
                setContainerRemoveErrorModal={this.state.setContainerRemoveErrorModal}
                handleCancelRemoveError={this.handleCancelRemoveError}
                handleForceRemoveContainer={this.handleForceRemoveContainer}
                containerWillDelete={this.state.containerWillDelete}
                containerRemoveErrorMsg={this.containerRemoveErrorMsg}
            />;

        const containerCommitModal =
            <ContainerCommitModal
                onHide={() => this.setState({ showCommitModal: false })}
                container={this.state.containerWillCommit}
                version={this.props.version}
            />;

        return (
            <div id="containers-containers" className="containers-containers">
                <ListingTable caption={_("Containers")}
                    variant='compact'
                    emptyCaption={emptyCaption}
                    columns={columnTitles}
                    rows={rows}
                />
                {containerDeleteModal}
                {containerCheckpointModal}
                {containerRestoreModal}
                {containerRemoveErrorModal}
                {this.state.showCommitModal && containerCommitModal}
            </div>
        );
    }
}

export default Containers;
