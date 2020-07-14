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
            setContainerRemoveErrorModal: false,
            containerWillDelete: {},
            width: 0,
        };
        this.renderRow = this.renderRow.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);
        this.restartContainer = this.restartContainer.bind(this);
        this.startContainer = this.startContainer.bind(this);
        this.stopContainer = this.stopContainer.bind(this);
        this.deleteContainer = this.deleteContainer.bind(this);
        this.handleCancelContainerDeleteModal = this.handleCancelContainerDeleteModal.bind(this);
        this.handleRemoveContainer = this.handleRemoveContainer.bind(this);
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
            this.setState((prevState) => ({
                containerWillDelete: container,
                selectContainerDeleteModal: true,
            }));
        }
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

    renderRow(containersStats, container) {
        const containerStats = containersStats[container.Id + container.isSystem.toString()];
        const isRunning = container.State == "running";
        const image = container.Image;

        let proc = "";
        let mem = "";
        if (containerStats) {
            proc = containerStats.cpu_stats ? containerStats.cpu_stats.cpu.toFixed(2) + "%" : <abbr title={_("not available")}>{_("n/a")}</abbr>;
            mem = containerStats.memory_stats ? utils.format_memory_and_limit(containerStats.memory_stats.usage, containerStats.memory_stats.limit) : <abbr title={_("not available")}>{_("n/a")}</abbr>;
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
            container.State /* FIXME: i18n */,
        ];

        const tabs = [{
            name: _("Details"),
            renderer: ContainerDetails,
            data: { container: container }
        }, {
            name: _("Logs"),
            renderer: ContainerLogs,
            data: { containerId: container.Id, width:this.state.width, system:container.isSystem }
        }, {
            name: _("Console"),
            renderer: ContainerTerminal,
            data: { containerId: container.Id, containerStatus: container.State, width:this.state.width, system:container.isSystem }
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
            actions.push(
                <Button key={container.Id + "start"} variant="secondary" onClick={() => this.startContainer(container)}>
                    {_("Start")}
                </Button>
            );
        } else {
            const restartActions = [];
            const stopActions = [];

            restartActions.push({ label: _("Restart"), onActivate: () => this.restartContainer(container) });
            restartActions.push({ label: _("Force Restart"), onActivate: () => this.restartContainer(container, true) });
            actions.push(<DropDown key={_(container.Id) + "restart"} actions={restartActions} />);

            stopActions.push({ label: _("Stop"), onActivate: () => this.stopContainer(container) });
            stopActions.push({ label: _("Force Stop"), onActivate: () => this.stopContainer(container, true) });
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

        const rows = filtered.map(id => this.renderRow(containersStats, this.props.containers[id]));
        const containerDeleteModal =
            <ContainerDeleteModal
                selectContainerDeleteModal={this.state.selectContainerDeleteModal}
                containerWillDelete={this.state.containerWillDelete}
                handleCancelContainerDeleteModal={this.handleCancelContainerDeleteModal}
                handleRemoveContainer={this.handleRemoveContainer}
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
                {containerRemoveErrorModal}
                {this.state.showCommitModal && containerCommitModal}
            </div>
        );
    }
}

export default Containers;
