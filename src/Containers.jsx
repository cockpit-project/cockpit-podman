import React from 'react';
import ReactDOM from "react-dom";
import { Alert } from 'patternfly-react';

import cockpit from 'cockpit';
import * as Listing from '../lib/cockpit-components-listing.jsx';
import ContainerDetails from './ContainerDetails.jsx';
import ContainerTerminal from './ContainerTerminal.jsx';
import Dropdown from './Dropdown.jsx';
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
        let args = { name: container.names };

        if (force)
            args.timeout = 0;
        utils.podmanCall("StopContainer", args)
                .catch(ex => this.setState({
                    actionError: cockpit.format(_("Failed to stop container $0"), container.names),
                    actionErrorDetail: ex.parameters && ex.parameters.reason
                }));
    }

    startContainer(container) {
        utils.podmanCall("StartContainer", { name: container.names })
                .catch(ex => this.setState({
                    actionError: cockpit.format(_("Failed to start container $0"), container.names),
                    actionErrorDetail: ex.parameters && ex.parameters.reason
                }));
    }

    restartContainer (container, force) {
        let args = { name: container.names };

        if (force)
            args.timeout = 0;
        utils.podmanCall("RestartContainer", args)
                .catch(ex => this.setState({
                    actionError: cockpit.format(_("Failed to restart container $0"), container.names),
                    actionErrorDetail: ex.parameters && ex.parameters.reason
                }));
    }

    renderRow(containersStats, container) {
        const containerStats = containersStats[container.id];
        const isRunning = container.status == "running";
        const image = container.image;

        let columns = [
            { name: container.names, header: true },
            image,
            utils.quote_cmdline(container.command),
            isRunning ? utils.format_cpu_percent(containerStats.cpu * 100) : "",
            containerStats ? utils.format_memory_and_limit(containerStats.mem_usage, containerStats.mem_limit) : "",
            container.status /* TODO: i18n */,
        ];
        let tabs = [{
            name: _("Details"),
            renderer: ContainerDetails,
            data: { container: container }
        }, {
            name: _("Console"),
            renderer: ContainerTerminal,
            data: { containerId: container.id, containerStatus: container.status, width:this.state.width }
        }];

        var actions = [
            <button
                key={container.id + "delete"}
                className="btn btn-danger btn-delete pficon pficon-delete"
                onClick={(event) => this.deleteContainer(container, event)} />,
            <button
                key={container.id + "commit"}
                className="btn btn-default btn-commit"
                data-container-id={container.id}
                data-toggle="modal" data-target="#container-commit-dialog"
                onClick={() => this.setState({ showCommitModal: true, containerWillCommit: container })}
            >
                {_("Commit")}
            </button>,
        ];
        if (!isRunning) {
            actions.push(
                <button key={container.ID + "start"} className="btn btn-default" type="button" onClick={() => this.startContainer(container)}>
                    {_("Start")}
                </button>
            );
        } else {
            let restartActions = [];
            let stopActions = [];

            restartActions.push({ label: _("Restart"), onActivate: () => this.restartContainer(container) });
            restartActions.push({ label: _("Force Restart"), onActivate: () => this.restartContainer(container, true) });
            actions.push(<Dropdown key={_(container.ID) + "restart"} actions={restartActions} />);

            stopActions.push({ label: _("Stop"), onActivate: () => this.stopContainer(container) });
            stopActions.push({ label: _("Force Stop"), onActivate: () => this.stopContainer(container, true) });
            actions.push(<Dropdown key={_(container.ID) + "stop"} actions={stopActions} />);
        }

        return (
            <ScrollableAnchor id={container.id} key={container.id}>
                <Listing.ListingRow
                        rowId={container.id}
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
        utils.podmanCall("RemoveContainer", { name: id })
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
        utils.podmanCall("RemoveContainer", { name: id, force: true })
                .then(reply => {
                    this.setState({
                        setContainerRemoveErrorModal: false
                    });
                })
                .catch(ex => console.error("Failed to do RemoveContainerForce call:", JSON.stringify(ex)));
    }

    onWindowResize() {
        this.setState({
            width: ReactDOM.findDOMNode(this).clientWidth
        });
    }

    render() {
        const columnTitles = [_("Name"), _("Image"), _("Command"), _("CPU"), _("Memory"), _("State")];

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
            let lcf = this.props.textFilter.toLowerCase();
            filtered = filtered.filter(id => this.props.containers[id].names.toLowerCase().indexOf(lcf) >= 0 ||
                    this.props.containers[id].image.toLowerCase().indexOf(lcf) >= 0
            );
        }
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
                onHide={() => this.setState({ showCommitModal: false })}
                container={this.state.containerWillCommit}
            />;
        const { actionError, actionErrorDetail } = this.state;

        return (
            <div id="containers-containers" className="containers-containers">
                {actionError && <Alert onDismiss={() => this.setState({ actionError: undefined })}>
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
                {this.state.showCommitModal && containerCommitModal}
            </div>
        );
    }
}

export default Containers;
