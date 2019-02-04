import React from 'react';
import { Alert } from 'patternfly-react';

import cockpit from 'cockpit';
import * as Listing from '../lib/cockpit-components-listing.jsx';
import ContainerDetails from './ContainerDetails.jsx';
import Dropdown from './Dropdown.jsx';
import ContainerDeleteModal from './ContainerDeleteModal.jsx';
import ContainerRemoveErrorModal from './ContainerRemoveErrorModal.jsx';
import * as utils from './util.js';
import ContainerCommitModal from './ContainerCommitModal.jsx';
import varlink from './varlink.js';

const _ = cockpit.gettext;

class Containers extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            selectContainerDeleteModal: false,
            setContainerRemoveErrorModal: false,
            containerCommitErrorMsg: "",
            containerWillDelete: {},
            containerWillCommit: {},
        };
        this.renderRow = this.renderRow.bind(this);
        this.restartContainer = this.restartContainer.bind(this);
        this.startContainer = this.startContainer.bind(this);
        this.stopContainer = this.stopContainer.bind(this);
        this.deleteContainer = this.deleteContainer.bind(this);
        this.dialogErrorDismiss = this.dialogErrorDismiss.bind(this);
        this.handleCancelContainerDeleteModal = this.handleCancelContainerDeleteModal.bind(this);
        this.handleRemoveContainer = this.handleRemoveContainer.bind(this);
        this.handleCancelRemoveError = this.handleCancelRemoveError.bind(this);
        this.handleForceRemoveContainer = this.handleForceRemoveContainer.bind(this);
        this.handleContainerCommitModal = this.handleContainerCommitModal.bind(this);
        this.handleCancelContainerCommitModal = this.handleCancelContainerCommitModal.bind(this);
        this.handleContainerCommit = this.handleContainerCommit.bind(this);
    }

    navigateToContainer(container) {
        cockpit.location.go([container.id]);
    }

    dialogErrorDismiss() {
        this.setState({ containerCommitErrorMsg: undefined });
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

    stopContainer(container) {
        varlink.call(utils.PODMAN_ADDRESS, "io.podman.StopContainer", { name: container.names })
                .then(() => this.props.updateContainersAfterEvent())
                .catch(ex => this.setState({
                    actionError: cockpit.format(_("Failed to stop container $0"), container.names),
                    actionErrorDetail: ex.parameters && ex.parameters.reason
                }));
    }

    startContainer(container) {
        varlink.call(utils.PODMAN_ADDRESS, "io.podman.StartContainer", { name: container.names })
                .then(() => this.props.updateContainersAfterEvent())
                .catch(ex => this.setState({
                    actionError: cockpit.format(_("Failed to start container $0"), container.names),
                    actionErrorDetail: ex.parameters && ex.parameters.reason
                }));
    }

    restartContainer (container) {
        varlink.call(utils.PODMAN_ADDRESS, "io.podman.RestartContainer", { name: container.names })
                .then(() => this.props.updateContainersAfterEvent())
                .catch(ex => this.setState({
                    actionError: cockpit.format(_("Failed to restart container $0"), container.names),
                    actionErrorDetail: ex.parameters && ex.parameters.reason
                }));
    }

    handleContainerCommitModal(event, container) {
        this.setState((prevState) => ({
            containerWillCommit: container,
            setContainerCommitModal: !prevState.setContainerCommitModal
        }));
    }

    handleCancelContainerCommitModal() {
        this.setState((prevState) => ({
            setContainerCommitModal: !prevState.setContainerCommitModal
        }));
    }

    handleContainerCommit(commitMsg) {
        if (!commitMsg.imageName) {
            this.setState({ containerCommitErrorMsg: "Image name is required" });
            return;
        }
        let cmdStr = "";
        if (commitMsg.command.trim() === "") {
            cmdStr = this.state.containerWillCommit.Config ? this.state.containerWillCommit.Config.Cmd.join(" ") : "";
        } else {
            cmdStr = commitMsg.command.trim();
        }

        let commitData = {};
        commitData.name = this.state.containerWillCommit.id;
        commitData.image_name = commitMsg.tag ? commitMsg.imageName + ":" + commitMsg.tag : commitMsg.imageName;
        commitData.author = commitMsg.author;
        commitData.message = commitMsg.message;
        commitData.pause = commitMsg.pause;
        commitData.format = commitMsg.format;

        commitData.changes = [];
        let cmdData = "CMD=" + cmdStr;
        commitData.changes.push(cmdData);

        let onbuildsArr = [];
        if (commitMsg.setonbuild) {
            onbuildsArr = utils.getCommitArr(commitMsg.onbuild, "ONBUILD");
        }
        commitData.changes.push(...onbuildsArr);

        varlink.call(utils.PODMAN_ADDRESS, "io.podman.Commit", commitData)
                .then(reply => {
                    this.props.updateImagesAfterEvent();
                    this.props.updateContainersAfterEvent();
                    this.setState({ setContainerCommitModal: false });
                })
                .catch(ex => {
                    this.setState({ containerCommitErrorMsg: JSON.stringify(ex) });
                    console.error("Failed to do Commit call:", ex, JSON.stringify(ex));
                });
    }

    renderRow(containersStats, container) {
        const containerStats = containersStats[container.id];
        const isRunning = container.status == "running";
        const image = container.image;

        let columns = [
            { name: container.names, header: true },
            image,
            container.command.join(" "),
            isRunning ? utils.format_cpu_percent(containerStats.cpu * 100) : "",
            containerStats ? utils.format_memory_and_limit(containerStats.mem_usage, containerStats.mem_limit) : "",
            container.status /* TODO: i18n */,

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
            onActivate: this.restartContainer,
            disabled: !isRunning
        });

        var actions = [
            <button
                key={container.id + "delete"}
                className="btn btn-danger btn-delete pficon pficon-delete"
                onClick={(event) => this.deleteContainer(container, event)} />,
            <button
                key={container.id + "commit"}
                className="btn btn-default btn-commit"
                disabled={isRunning}
                data-container-id={container.id}
                data-toggle="modal" data-target="#container-commit-dialog"
                onClick={(event) => this.handleContainerCommitModal(event, container)}
            >
                {_("Commit")}
            </button>,
            // TODO: stop or start dropdown menu
            <Dropdown key={_(container.id)} actions={startStopActions} />
        ];

        return <Listing.ListingRow
                    key={container.id}
                    rowId={container.id}
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
        const id = this.state.containerWillDelete ? this.state.containerWillDelete.id : "";
        this.setState({
            selectContainerDeleteModal: false
        });
        varlink.call(utils.PODMAN_ADDRESS, "io.podman.RemoveContainer", {name: id})
                .then((reply) => {
                    this.props.updateContainersAfterEvent();
                })
                .catch(ex => console.error("Failed to do RemoveContainer call:", JSON.stringify(ex)));
    }

    handleCancelRemoveError() {
        this.setState({
            setContainerRemoveErrorModal: false
        });
    }

    // TODO: force
    handleForceRemoveContainer() {
        const id = this.state.containerWillDelete ? this.state.containerWillDelete.id : "";
        varlink.call(utils.PODMAN_ADDRESS, "io.podman.RemoveContainer", {name: id, force: true})
                .then(reply => {
                    this.setState({
                        setContainerRemoveErrorModal: false
                    });
                    this.props.updateContainersAfterEvent();
                })
                .catch(ex => console.error("Failed to do RemoveContainerForce call:", JSON.stringify(ex)));
    }

    render() {
        const columnTitles = [_("Name"), _("Image"), _("Command"), _("CPU"), _("Memory"), _("State")];
        // TODO: emptyCaption
        let emptyCaption = _("No running containers");
        const containersStats = this.props.containersStats;
        // TODO: check filter text
        let filtered = Object.keys(this.props.containers).filter(id => !this.props.onlyShowRunning || this.props.containers[id].status == "running");
        let rows = filtered.map(id => this.renderRow(containersStats, this.props.containers[id]));
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
                setContainerCommitModal={this.state.setContainerCommitModal}
                handleContainerCommit={this.handleContainerCommit}
                handleCancelContainerCommitModal={this.handleCancelContainerCommitModal}
                containerWillCommit={this.state.containerWillCommit}
                dialogError={this.state.containerCommitErrorMsg}
                dialogErrorDismiss={this.dialogErrorDismiss}
            />;
        const { actionError, actionErrorDetail } = this.state;

        return (
            <div id="containers-containers" className="container-fluid ">
                {actionError && <Alert onDismiss={() => this.setState({actionError: undefined})}>
                    <strong>
                        {actionError}
                    </strong>
                    { actionErrorDetail && <p> {_("Error message")}: <samp>{actionErrorDetail}</samp> </p> }
                </Alert> }
                <Listing.Listing key={"ContainerListing"} title={_("Containers")} columnTitles={columnTitles} emptyCaption={emptyCaption}>
                    {rows}
                </Listing.Listing>
                {containerDeleteModal}
                {containerRemoveErrorModal}
                {containerCommitModal}
            </div>
        );
    }
}

export default Containers;
