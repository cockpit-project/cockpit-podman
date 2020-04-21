import React from 'react';
import ReactDOM from "react-dom";
import { Button } from '@patternfly/react-core';

import cockpit from 'cockpit';
import * as Listing from '../lib/cockpit-components-listing.jsx';
import ContainerDetails from './ContainerDetails.jsx';
import ContainerTerminal from './ContainerTerminal.jsx';
import ContainerLogs from './ContainerLogs.jsx';
import { DropDown } from './Dropdown.jsx';
import ContainerDeleteModal from './ContainerDeleteModal.jsx';
import ContainerRemoveErrorModal from './ContainerRemoveErrorModal.jsx';
import * as utils from './util.js';
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
        if (container.status == "running") {
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
        const args = { name: container.names };

        if (force)
            args.timeout = 0;
        utils.podmanCall("StopContainer", args, container.isSystem)
                .catch(ex => {
                    const error = cockpit.format(_("Failed to stop container $0"), container.names);
                    const errorDetail = ex.parameters && ex.parameters.reason;
                    this.props.onAddNotification({ type: 'danger', error, errorDetail });
                });
    }

    startContainer(container) {
        utils.podmanCall("StartContainer", { name: container.names }, container.isSystem)
                .catch(ex => {
                    const error = cockpit.format(_("Failed to start container $0"), container.names);
                    const errorDetail = ex.parameters && ex.parameters.reason;
                    this.props.onAddNotification({ type: 'danger', error, errorDetail });
                });
    }

    restartContainer (container, force) {
        const args = { name: container.names };

        if (force)
            args.timeout = 0;
        utils.podmanCall("RestartContainer", args, container.isSystem)
                .catch(ex => {
                    const error = cockpit.format(_("Failed to restart container $0"), container.names);
                    const errorDetail = ex.parameters && ex.parameters.reason;
                    this.props.onAddNotification({ type: 'danger', error, errorDetail });
                });
    }

    renderRow(containersStats, container) {
        const containerStats = containersStats[container.id + container.isSystem.toString()];
        const isRunning = container.status == "running";
        const image = container.image;

        let proc = "";
        let mem = "";
        if (containerStats) {
            proc = containerStats.cpu ? utils.format_cpu_percent(containerStats.cpu * 100) : <abbr title={_("not available")}>{_("n/a")}</abbr>;
            mem = containerStats.mem_usage ? utils.format_memory_and_limit(containerStats.mem_usage, containerStats.mem_limit) : <abbr title={_("not available")}>{_("n/a")}</abbr>;
        }
        const columns = [
            { name: container.names, header: true },
            image,
            utils.quote_cmdline(container.command),
            proc,
            mem,
            container.isSystem ? _("system") : this.props.user,
            container.status /* TODO: i18n */,
        ];
        const tabs = [{
            name: _("Details"),
            renderer: ContainerDetails,
            data: { container: container }
        }, {
            name: _("Logs"),
            renderer: ContainerLogs,
            data: { containerId: container.id, width:this.state.width, system:container.isSystem }
        }, {
            name: _("Console"),
            renderer: ContainerTerminal,
            data: { containerId: container.id, containerStatus: container.status, width:this.state.width, system:container.isSystem }
        }];

        var actions = [
            <Button
                key={container.id + "delete"}
                variant="danger"
                className="btn-delete"
                aria-label={_("Delete image")}
                onClick={(event) => this.deleteContainer(container, event)}>
                <span className="pficon pficon-delete" />
            </Button>,
            <Button
                key={container.id + "commit"}
                variant="secondary"
                className="btn-commit"
                data-container-id={container.id}
                data-toggle="modal" data-target="#container-commit-dialog"
                onClick={() => this.setState({ showCommitModal: true, containerWillCommit: container })}
            >
                {_("Commit")}
            </Button>,
        ];
        if (!isRunning) {
            actions.push(
                <Button key={container.ID + "start"} variant="secondary" onClick={() => this.startContainer(container)}>
                    {_("Start")}
                </Button>
            );
        } else {
            const restartActions = [];
            const stopActions = [];

            restartActions.push({ label: _("Restart"), onActivate: () => this.restartContainer(container) });
            restartActions.push({ label: _("Force Restart"), onActivate: () => this.restartContainer(container, true) });
            actions.push(<DropDown key={_(container.ID) + "restart"} actions={restartActions} />);

            stopActions.push({ label: _("Stop"), onActivate: () => this.stopContainer(container) });
            stopActions.push({ label: _("Force Stop"), onActivate: () => this.stopContainer(container, true) });
            actions.push(<DropDown key={_(container.ID) + "stop"} actions={stopActions} />);
        }

        return (
            <ScrollableAnchor id={container.id} key={container.id}>
                <Listing.ListingRow
                        key={container.id + container.isSystem.toString()}
                        rowId={container.id + container.isSystem.toString()}
                        columns={columns}
                        tabRenderers={tabs}
                        listingActions={actions}
                />
            </ScrollableAnchor>
        );
    }

    handleCancelContainerDeleteModal() {
        this.setState((prevState) => ({
            selectContainerDeleteModal: !prevState.selectContainerDeleteModal,
        }));
    }

    handleRemoveContainer() {
        const id = this.state.containerWillDelete ? this.state.containerWillDelete.id : "";
        this.setState({
            selectContainerDeleteModal: false
        });
        utils.podmanCall("RemoveContainer", { name: id }, this.state.containerWillDelete.isSystem)
                .catch(ex => {
                    const error = cockpit.format(_("Failed to remove container $0"), this.state.containerWillDelete.names);
                    const errorDetail = ex.parameters && ex.parameters.reason;
                    this.props.onAddNotification({ type: 'danger', error, errorDetail });
                });
    }

    handleCancelRemoveError() {
        this.setState({
            setContainerRemoveErrorModal: false
        });
    }

    // TODO: force
    handleForceRemoveContainer() {
        const id = this.state.containerWillDelete ? this.state.containerWillDelete.id : "";
        return utils.podmanCall("RemoveContainer", { name: id, force: true }, this.state.containerWillDelete.isSystem)
                .then(reply => {
                    this.setState({
                        setContainerRemoveErrorModal: false
                    });
                }, ex => {
                    const error = cockpit.format(_("Failed to force remove container $0"), this.state.containerWillDelete.names);
                    const errorDetail = ex.parameters && ex.parameters.reason;
                    this.props.onAddNotification({ type: 'danger', error, errorDetail });
                });
    }

    onWindowResize() {
        this.setState({
            width: ReactDOM.findDOMNode(this).clientWidth
        });
    }

    render() {
        const columnTitles = [_("Name"), _("Image"), _("Command"), _("CPU"), _("Memory"), _("Owner"), _("State")];

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
            filtered = Object.keys(this.props.containers).filter(id => !this.props.onlyShowRunning || this.props.containers[id].status == "running");
        if (this.props.textFilter.length > 0) {
            const lcf = this.props.textFilter.toLowerCase();
            filtered = filtered.filter(id => this.props.containers[id].names.toLowerCase().indexOf(lcf) >= 0 ||
                    this.props.containers[id].image.toLowerCase().indexOf(lcf) >= 0
            );
        }

        filtered.sort((a, b) => {
            // User containers are in front of system ones
            if (this.props.containers[a].isSystem !== this.props.containers[b].isSystem)
                return this.props.containers[a].isSystem ? 1 : -1;
            return this.props.containers[a].names > this.props.containers[b].names ? 1 : -1;
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
                <Listing.Listing key="ContainerListing" title={_("Containers")} columnTitles={columnTitles} emptyCaption={emptyCaption}>
                    {rows}
                </Listing.Listing>
                {containerDeleteModal}
                {containerRemoveErrorModal}
                {this.state.showCommitModal && containerCommitModal}
            </div>
        );
    }
}

export default Containers;
