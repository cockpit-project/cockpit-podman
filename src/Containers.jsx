import React from 'react';
import cockpit from 'cockpit';
import * as Listing from '../lib/cockpit-components-listing.jsx';
import ContainerDetails from './ContainerDetails.jsx';
import Dropdown from './DropdownContainer.jsx';
import ContainerDeleteModal from './ContainerDeleteModal.jsx';
import ContainerRemoveErrorModal from './ContainerRemoveErrorModal.jsx';
import * as utils from './util.js';

const _ = cockpit.gettext;

class Containers extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            selectContainerDeleteModal: false,
            setContainerRemoveErrorModal: false,
            containerWillDelete: {},
            setWaitCursor: "",
        };

        this.renderRow = this.renderRow.bind(this);
        this.restartContainer = this.restartContainer.bind(this);
        this.startContainer = this.startContainer.bind(this);
        this.stopContainer = this.stopContainer.bind(this);
        this.deleteContainer = this.deleteContainer.bind(this);
        this.handleCancelContainerDeleteModal = this.handleCancelContainerDeleteModal.bind(this);
        this.handleRemoveContainer = this.handleRemoveContainer.bind(this);
        this.handleCancelRemoveError = this.handleCancelRemoveError.bind(this);
        this.handleForceRemoveContainer = this.handleForceRemoveContainer.bind(this);
    }

    navigateToContainer(container) {
        cockpit.location.go([container.ID]);
    }

    deleteContainer(container, event) {
        event.preventDefault();
        this.setState((prevState) => ({
            containerWillDelete: container,
            selectContainerDeleteModal: !prevState.selectContainerDeleteModal,
        }));
    }

    // TODO
    stopContainer(container, timeout) {
        return undefined;
    }

    // TODO
    startContainer (container) {
    }

    // TODO
    restartContainer (container, timeout) {
        return undefined;
    }

    renderRow(containersStats, container) {
        const isRunning = !!container.State.Running;
        const containerStats = isRunning ? containersStats[container.ID] : undefined;
        const image = container.ImageName;
        const state = container.State.Status;

        let columns = [
            { name: container.Name, header: true },
            image,
            container.Config.Cmd ? container.Config.Cmd.join(" ") : undefined,
            container.State.Running ? utils.format_cpu_percent(container.HostConfig.CpuPercent) : "",
            container.State.Running && containerStats ? utils.format_memory_and_limit(containerStats.mem_usage, containerStats.mem_limit) : "",
            state /* TODO: i18n */,
        ];
        let tabs = [{
            name: _("Details"),
            renderer: ContainerDetails,
            data: { container: container }
        }];

        let startStopActions = [];
        if (isRunning)
            startStopActions.push({ label: _("Stop"), onActivate: () => this.stopContainer(container) });
        else
            startStopActions.push({ label: _("Start"), onActivate: () => this.startContainer(container) });

        startStopActions.push({
            label: _("Restart"),
            onActivate: () => this.restartContainer(container),
            disabled: !isRunning
        });

        var actions = [
            <button
                key={container.ID + "delete"}
                className="btn btn-danger btn-delete pficon pficon-delete"
                onClick={(event) => this.deleteContainer(container, event)} />,
            <button
                key={container.ID + "commit"}
                className="btn btn-default"
                disabled={isRunning}
                data-container-id={container.ID}
                data-toggle="modal" data-target="#container-commit-dialog"
            >
                {_("Commit")}
            </button>,
            <Dropdown key={_(container.ID)} actions={startStopActions} />
        ];

        return <Listing.ListingRow
                    key={container.ID}
                    rowId={container.ID}
                    columns={columns}
                    tabRenderers={tabs}
                    navigateToItem={() => this.navigateToContainer(container)}
                    listingActions={actions}
        />;
    }

    handleCancelContainerDeleteModal() {
        this.setState((prevState) => ({
            selectContainerDeleteModal: !prevState.selectContainerDeleteModal,
        }));
    }

    handleRemoveContainer() {
        document.body.classList.add('busy-cursor');
        const container = this.state.containerWillDelete;
        const id = this.state.containerWillDelete ? this.state.containerWillDelete.ID : "";
        this.setState({
            selectContainerDeleteModal: false
        });
        utils.varlinkCall(utils.PODMAN, "io.podman.RemoveContainer", {name: id})
                .then((reply) => {
                    this.props.updateContainersAfterEvent();
                })
                .catch((ex) => {
                    if (container.State.Running) {
                        this.containerRemoveErrorMsg = _(ex);
                    } else {
                        this.containerRemoveErrorMsg = _("Container is currently marked as not running, but regular stopping failed.") +
                        " " + _("Error message from Podman:") + " '" + ex;
                    }
                    this.setState({
                        setContainerRemoveErrorModal: true
                    });
                    document.body.classList.remove('busy-cursor');
                });
    }

    handleCancelRemoveError() {
        this.setState({
            setContainerRemoveErrorModal: false
        });
    }

    handleSetWaitCursor() {
        this.setState((prevState) => ({
            setWaitCursor: prevState.setWaitCursor === "" ? "wait-cursor" : ""
        }));
    }

    handleForceRemoveContainer() {
        document.body.classList.add('busy-cursor');
        this.handleSetWaitCursor();
        const id = this.state.containerWillDelete ? this.state.containerWillDelete.ID : "";
        utils.varlinkCall(utils.PODMAN, "io.podman.RemoveContainer", {name: id, force: true})
                .then(reply => {
                    this.props.updateContainersAfterEvent();
                    this.setState({
                        setContainerRemoveErrorModal: false
                    });
                    this.handleSetWaitCursor();
                })
                .catch(ex => console.error("Failed to do RemoveContainerForce call:", JSON.stringify(ex)));
    }

    render() {
        const columnTitles = [_("Name"), _("Image"), _("Command"), _("CPU"), _("Memory"), _("State")];
        // TODO: emptyCaption
        let emptyCaption = _("No running containers");
        const containersStats = this.props.containersStats;
        // TODO: check filter text
        let filtered = [];
        Object.keys(this.props.containers).filter(id => { if (!this.props.onlyShowRunning || this.props.containers[id].State.Running) { filtered[id] = this.props.containers[id] } });
        let rows = Object.keys(filtered).map(function (id) {
            return this.renderRow(containersStats, this.props.containers[id]);
        }, this);
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
                setWaitCursor={this.state.setWaitCursor}
            />;

        return (
            <div id="containers-containers" className="container-fluid ">
                <div>
                    <Listing.Listing key={"ContainerListing"} title={_("Containers")} columnTitles={columnTitles} emptyCaption={emptyCaption}>
                        {rows}
                    </Listing.Listing>
                    {containerDeleteModal}
                    {containerRemoveErrorModal}
                </div>
            </div>
        );
    }
}

export default Containers;
