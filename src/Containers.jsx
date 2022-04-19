import React, { useState } from 'react';
import {
    Badge,
    Button,
    Card, CardBody, CardHeader, CardTitle, CardActions,
    Divider,
    Dropdown, DropdownItem, DropdownSeparator,
    Flex,
    KebabToggle,
    Text, TextVariants, FormSelect, FormSelectOption,
    Toolbar, ToolbarContent, ToolbarItem,
} from '@patternfly/react-core';
import { cellWidth } from '@patternfly/react-table';

import cockpit from 'cockpit';
import { ListingTable } from "cockpit-components-table.jsx";
import { ListingPanel } from 'cockpit-components-listing-panel.jsx';
import ContainerDetails from './ContainerDetails.jsx';
import ContainerTerminal from './ContainerTerminal.jsx';
import ContainerLogs from './ContainerLogs.jsx';
import ContainerDeleteModal from './ContainerDeleteModal.jsx';
import ContainerCheckpointModal from './ContainerCheckpointModal.jsx';
import ContainerRestoreModal from './ContainerRestoreModal.jsx';
import ForceRemoveModal from './ForceRemoveModal.jsx';
import * as utils from './util.js';
import * as client from './client.js';
import ContainerCommitModal from './ContainerCommitModal.jsx';
import ContainerRenameModal from './ContainerRenameModal.jsx';

import './Containers.scss';
import { ImageRunModal } from './ImageRunModal.jsx';
import { PodActions } from './PodActions.jsx';

const _ = cockpit.gettext;

const ContainerActions = ({ container, onAddNotification, version, localImages, updateContainerAfterEvent }) => {
    const [removeErrorModal, setRemoveErrorModal] = useState(false);
    const [deleteModal, setDeleteModal] = useState(false);
    const [checkpointInProgress, setCheckpointInProgress] = useState(false);
    const [checkpointModal, setCheckpointModal] = useState(false);
    const [restoreInProgress, setRestoreInProgress] = useState(false);
    const [restoreModal, setRestoreModal] = useState(false);
    const [commitModal, setCommitModal] = useState(false);
    const [renameModal, setRenameModal] = useState(false);
    const [isActionsKebabOpen, setActionsKebabOpen] = useState(false);
    const isRunning = container.State == "running";
    const isPaused = container.State === "paused";

    const deleteContainer = (event) => {
        if (container.State == "running") {
            setRemoveErrorModal(true);
            setDeleteModal(false);
        } else {
            setDeleteModal(true);
        }
        setActionsKebabOpen(false);
    };

    const stopContainer = (force) => {
        const args = {};

        setActionsKebabOpen(false);

        if (force)
            args.t = 0;
        client.postContainer(container.isSystem, "stop", container.Id, args)
                .catch(ex => {
                    const error = cockpit.format(_("Failed to stop container $0"), container.Names);
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                });
    };

    const startContainer = () => {
        setActionsKebabOpen(false);

        client.postContainer(container.isSystem, "start", container.Id, {})
                .catch(ex => {
                    const error = cockpit.format(_("Failed to start container $0"), container.Names);
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                });
    };

    const resumeContainer = () => {
        setActionsKebabOpen(false);

        client.postContainer(container.isSystem, "unpause", container.Id, {})
                .catch(ex => {
                    const error = cockpit.format(_("Failed to resume container $0"), container.Names);
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                });
    };

    const pauseContainer = () => {
        setActionsKebabOpen(false);

        client.postContainer(container.isSystem, "pause", container.Id, {})
                .catch(ex => {
                    const error = cockpit.format(_("Failed to pause container $0"), container.Names);
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                });
    };

    const restartContainer = (force) => {
        const args = {};

        setActionsKebabOpen(false);

        if (force)
            args.t = 0;
        client.postContainer(container.isSystem, "restart", container.Id, args)
                .catch(ex => {
                    const error = cockpit.format(_("Failed to restart container $0"), container.Names);
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                });
    };

    const renameContainer = () => {
        setRenameModal(container.State !== "running" || version.localeCompare("3.0.1", undefined, { numeric: true, sensitivity: 'base' }) >= 0);
        setActionsKebabOpen(false);
    };

    const handleRemoveContainer = () => {
        const id = container ? container.Id : "";

        setDeleteModal(false);
        setActionsKebabOpen(false);

        client.delContainer(container.isSystem, id, false)
                .catch(ex => {
                    const error = cockpit.format(_("Failed to remove container $0"), container.Names);
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                });
    };

    const handleCheckpointContainer = (args) => {
        setCheckpointInProgress(true);
        setActionsKebabOpen(false);

        client.postContainer(container.isSystem, "checkpoint", container.Id, args)
                .catch(ex => {
                    const error = cockpit.format(_("Failed to checkpoint container $0"), container.Names);
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                })
                .finally(() => {
                    setCheckpointInProgress(false);
                    setCheckpointModal(false);
                });
    };

    const handleRestoreContainer = (args) => {
        setRestoreInProgress(true);
        setActionsKebabOpen(false);

        client.postContainer(container.isSystem, "restore", container.Id, args)
                .catch(ex => {
                    const error = cockpit.format(_("Failed to restore container $0"), container.Names);
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                })
                .finally(() => {
                    setRestoreInProgress(false);
                    setRestoreModal(false);
                });
    };

    const handleForceRemoveContainer = () => {
        const id = container ? container.Id : "";

        setActionsKebabOpen(false);

        return client.delContainer(container.isSystem, id, true)
                .then(() => {
                    setRemoveErrorModal(false);
                }, ex => {
                    const error = cockpit.format(_("Failed to force remove container $0"), container.Names);
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                    throw ex;
                });
    };

    const addRenameAction = () => {
        actions.push(
            <DropdownItem key="rename"
                        onClick={() => renameContainer()}>
                {_("Rename")}
            </DropdownItem>
        );
    };

    const actions = [];
    if (isRunning || isPaused) {
        actions.push(
            <DropdownItem key="stop"
                          onClick={() => stopContainer()}>
                {_("Stop")}
            </DropdownItem>,
            <DropdownItem key="force-stop"
                          onClick={() => stopContainer(true)}>
                {_("Force stop")}
            </DropdownItem>,
            <DropdownItem key="restart"
                          onClick={() => restartContainer()}>
                {_("Restart")}
            </DropdownItem>,
            <DropdownItem key="force-restart"
                          onClick={() => restartContainer(true)}>
                {_("Force restart")}
            </DropdownItem>
        );

        if (!isPaused) {
            actions.push(
                <DropdownItem key="pause"
                          onClick={() => pauseContainer()}>
                    {_("Pause")}
                </DropdownItem>
            );
        } else {
            actions.push(
                <DropdownItem key="resume"
                          onClick={() => resumeContainer()}>
                    {_("Resume")}
                </DropdownItem>
            );
        }

        if (container.isSystem && !isPaused) {
            actions.push(
                <DropdownSeparator key="separator-0" />,
                <DropdownItem key="checkpoint"
                              onClick={() => setCheckpointModal(true)}>
                    {_("Checkpoint")}
                </DropdownItem>
            );
        }
    }

    if (!isRunning && !isPaused) {
        actions.push(
            <DropdownItem key="start"
                          onClick={() => startContainer()}>
                {_("Start")}
            </DropdownItem>
        );
        if (version.localeCompare("3", undefined, { numeric: true, sensitivity: 'base' }) >= 0) {
            addRenameAction();
        }
        if (container.isSystem && container.hasCheckpoint) {
            actions.push(
                <DropdownSeparator key="separator-0" />,
                <DropdownItem key="restore"
                              onClick={() => setRestoreModal(true)}>
                    {_("Restore")}
                </DropdownItem>
            );
        }
    } else { // running or paused
        if (version.localeCompare("3.0.1", undefined, { numeric: true, sensitivity: 'base' }) >= 0) {
            addRenameAction();
        }
    }

    actions.push(<DropdownSeparator key="separator-1" />);
    actions.push(
        <DropdownItem key="commit"
                      onClick={() => setCommitModal(true)}>
            {_("Commit")}
        </DropdownItem>
    );
    actions.push(<DropdownSeparator key="separator-2" />);
    actions.push(
        <DropdownItem key="delete"
                      className="pf-m-danger"
                      onClick={deleteContainer}>
            {_("Delete")}
        </DropdownItem>
    );

    const kebab = (
        <Dropdown toggle={<KebabToggle onToggle={isOpen => setActionsKebabOpen(isOpen)} />}
                  isOpen={isActionsKebabOpen}
                  isPlain
                  position="right"
                  dropdownItems={actions} />
    );

    const containerDeleteModal =
        <ContainerDeleteModal
            containerWillDelete={container}
            handleCancelContainerDeleteModal={() => setDeleteModal(false)}
            handleRemoveContainer={handleRemoveContainer}
        />;
    const containerCheckpointModal =
        <ContainerCheckpointModal
            handleCheckpointContainer={handleCheckpointContainer}
            handleCheckpointContainerDeleteModal={() => setCheckpointModal(false)}
            containerWillCheckpoint={container}
            checkpointInProgress={checkpointInProgress}
        />;
    const containerRestoreModal =
        <ContainerRestoreModal
            handleRestoreContainer={handleRestoreContainer}
            handleRestoreContainerDeleteModal={() => setRestoreModal(false)}
            containerWillCheckpoint={container}
            restoreInProgress={restoreInProgress}
        />;
    const containerRemoveErrorModal =
        <ForceRemoveModal
            name={container.Names}
            handleCancel={() => setRemoveErrorModal(false)}
            handleForceRemove={handleForceRemoveContainer}
            reason={_("Container is currently running.")}
        />;

    const containerCommitModal =
        <ContainerCommitModal
            onHide={() => setCommitModal(false)}
            container={container}
            version={version}
            localImages={localImages}
        />;

    const containerRenameModal =
        <ContainerRenameModal
            container={container}
            version={version}
            onHide={() => setRenameModal(false)}
            updateContainerAfterEvent={updateContainerAfterEvent}
        />;

    return (
        <>
            {kebab}
            {deleteModal && containerDeleteModal}
            {renameModal && containerRenameModal}
            {checkpointModal && containerCheckpointModal}
            {restoreModal && containerRestoreModal}
            {removeErrorModal && containerRemoveErrorModal}
            {commitModal && containerCommitModal}
        </>
    );
};

export let onDownloadContainer = function funcOnDownloadContainer(container) {
    this.setState(prevState => ({
        downloadingContainers: [...prevState.downloadingContainers, container]
    }));
};

export let onDownloadContainerFinished = function funcOnDownloadContainerFinished(container) {
    this.setState(prevState => ({
        downloadingContainers: prevState.downloadingContainers.filter(entry => entry.name !== container.name),
    }));
};

class Containers extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            width: 0,
            showCreateContainerModal: false,
            createPod: null,
            downloadingContainers: [],
        };
        this.renderRow = this.renderRow.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);

        this.cardRef = React.createRef();

        onDownloadContainer = onDownloadContainer.bind(this);
        onDownloadContainerFinished = onDownloadContainerFinished.bind(this);

        window.addEventListener('resize', this.onWindowResize);
    }

    componentDidMount() {
        this.onWindowResize();
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.onWindowResize);
    }

    renderRow(containersStats, container, containerDetail, localImages) {
        const containerStats = containersStats[container.Id + container.isSystem.toString()];
        const image = container.Image;

        let proc = "";
        let mem = "";
        if (this.props.cgroupVersion == 'v1' && !container.isSystem && container.State == 'running') {
            proc = <div><abbr title={_("not available")}>{_("n/a")}</abbr></div>;
            mem = <div><abbr title={_("not available")}>{_("n/a")}</abbr></div>;
        }
        if (containerStats) {
            if (containerStats.CPU != undefined)
                proc = containerStats.CPU.toFixed(2) + "%";
            if (containerStats.MemUsage != undefined && containerStats.MemLimit != undefined)
                mem = utils.format_memory_and_limit(containerStats.MemUsage, containerStats.MemLimit);
        }
        const info_block =
            <div className="container-block">
                <span className="container-name">{container.Names}</span>
                <small>{image}</small>
                <small>{utils.quote_cmdline(container.Command)}</small>
            </div>;

        let containerStateClass = "ct-badge-container-" + container.State.toLowerCase();
        if (container.isDownloading) {
            containerStateClass += " downloading";
        }
        const containerState = container.State.charAt(0).toUpperCase() + container.State.slice(1);
        const columns = [
            { title: info_block },
            { title: container.isSystem ? _("system") : <div><span className="ct-grey-text">{_("user:")} </span>{this.props.user}</div>, props: { modifier: "nowrap" } },
            { title: proc, props: { modifier: "nowrap" } },
            { title: mem, props: { modifier: "nowrap" } },
            { title: <Badge isRead className={containerStateClass}>{_(containerState)}</Badge> }, // States are defined in util.js
        ];

        if (!container.isDownloading) {
            columns.push({ title: <ContainerActions version={this.props.version} container={container} onAddNotification={this.props.onAddNotification} localImages={localImages} updateContainerAfterEvent={this.props.updateContainerAfterEvent} />, props: { className: "pf-c-table__action" } });
        }

        const tty = containerDetail ? !!containerDetail.Config.Tty : undefined;

        const tabs = [{
            name: _("Details"),
            renderer: ContainerDetails,
            data: { container: container, containerDetail: containerDetail }
        }, {
            name: _("Logs"),
            renderer: ContainerLogs,
            data: { containerId: container.Id, width: this.state.width, system: container.isSystem }
        }, {
            name: _("Console"),
            renderer: ContainerTerminal,
            data: { containerId: container.Id, containerStatus: container.State, width: this.state.width, system: container.isSystem, tty: tty }
        }];

        return {
            expandedContent: <ListingPanel colSpan='4'
                                           tabRenderers={tabs} />,
            columns: columns,
            initiallyExpanded: document.location.hash.substr(1) === container.Id,
            props: {
                key :container.Id + container.isSystem.toString(),
                "data-row-id": container.Id + container.isSystem.toString(),
            },
        };
    }

    onWindowResize() {
        this.setState({ width: this.cardRef.current.clientWidth });
    }

    render() {
        const columnTitles = [
            { title: _("Container"), transforms: [cellWidth(20)] },
            _("Owner"),
            _("CPU"),
            _("Memory"),
            _("State"),
            ''
        ];
        const partitionedContainers = { 'no-pod': [] };
        let filtered = [];

        let emptyCaption = _("No containers");
        const emptyCaptionPod = _("No containers in this pod");
        if (this.props.containers === null || this.props.pods === null)
            emptyCaption = _("Loading...");
        else if (this.props.textFilter.length > 0)
            emptyCaption = _("No containers that match the current filter");
        else if (this.props.filter == "running")
            emptyCaption = _("No running containers");

        if (this.props.containers !== null && this.props.pods !== null) {
            filtered = Object.keys(this.props.containers).filter(id => !(this.props.filter == "running") || this.props.containers[id].State == "running");

            if (this.props.userServiceAvailable && this.props.systemServiceAvailable && this.props.ownerFilter !== "all") {
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
                    (this.props.containers[id].Pod &&
                     this.props.pods[this.props.containers[id].Pod + this.props.containers[id].isSystem.toString()].Name.toLowerCase().indexOf(lcf) >= 0) ||
                    this.props.containers[id].Image.toLowerCase().indexOf(lcf) >= 0
                );
            }

            // Remove infra containers
            filtered = filtered.filter(id => !this.props.containers[id].IsInfra);

            filtered.sort((a, b) => {
                // User containers are in front of system ones
                if (this.props.containers[a].isSystem !== this.props.containers[b].isSystem)
                    return this.props.containers[a].isSystem ? 1 : -1;
                return this.props.containers[a].Names > this.props.containers[b].Names ? 1 : -1;
            });

            Object.keys(this.props.pods || {}).forEach(pod => { partitionedContainers[pod] = [] });

            filtered.forEach(id => {
                const container = this.props.containers[id];
                if (container)
                    (partitionedContainers[container.Pod ? (container.Pod + container.isSystem.toString()) : 'no-pod'] || []).push(container);
            });

            // Append downloading containers
            this.state.downloadingContainers.forEach(cont => {
                partitionedContainers['no-pod'].push(cont);
            });

            // Apply filters to pods
            Object.keys(partitionedContainers).forEach(section => {
                const lcf = this.props.textFilter.toLowerCase();
                if (section != "no-pod") {
                    const pod = this.props.pods[section];
                    if ((this.props.filter == "running" && pod.Status != "Running") ||
                        // If nor the pod name nor any container inside the pod fit the filter, hide the whole pod
                        (!partitionedContainers[section].length && pod.Name.toLowerCase().indexOf(lcf) < 0) ||
                        ((this.props.userServiceAvailable && this.props.systemServiceAvailable && this.props.ownerFilter !== "all") &&
                         ((this.props.ownerFilter === "system" && !pod.isSystem) ||
                            (this.props.ownerFilter !== "system" && pod.isSystem))))
                        delete partitionedContainers[section];
                }
            });
            // If there are pods to show and the generic container list is empty don't show  it at all
            if (Object.keys(partitionedContainers).length > 1 && !partitionedContainers["no-pod"].length)
                delete partitionedContainers["no-pod"];
        }

        // Convert to the search result output
        let localImages = null;
        if (this.props.images) {
            localImages = Object.keys(this.props.images).map(id => {
                const img = this.props.images[id];
                if (img.RepoTags) {
                    img.Index = img.RepoTags[0].split('/')[0];
                    img.Name = img.RepoTags[0];
                } else {
                    img.Name = "<none:none>";
                    img.Index = "";
                }
                img.toString = function imgToString() { return this.Name };

                return img;
            });
        }

        const filterRunning =
            <Toolbar>
                <ToolbarContent>
                    <ToolbarItem variant="label" htmlFor="containers-containers-filter">
                        {_("Show")}
                    </ToolbarItem>
                    <ToolbarItem>
                        <FormSelect id="containers-containers-filter" value={this.props.filter} onChange={this.props.handleFilterChange}>
                            <FormSelectOption value='running' label={_("Only running")} />
                            <FormSelectOption value='all' label={_("All")} />
                        </FormSelect>
                    </ToolbarItem>
                    <Divider isVertical />
                    <ToolbarItem>
                        <Button variant="primary" key="get-new-image-action"
                        id="containers-containers-create-container-btn"
                        isDisabled={localImages === null}
                        onClick={() => this.setState({ showCreateContainerModal: true })}>
                            {_("Create container")}
                        </Button>
                    </ToolbarItem>
                </ToolbarContent>
                {this.state.showCreateContainerModal && localImages &&
                <ImageRunModal
                user={this.props.user}
                localImages={localImages}
                close={() => this.setState({ showCreateContainerModal: false, createPod: null })}
                pod={this.state.createPod}
                registries={this.props.registries}
                selinuxAvailable={this.props.selinuxAvailable}
                podmanRestartAvailable={this.props.podmanRestartAvailable}
                systemServiceAvailable={this.props.systemServiceAvailable}
                userServiceAvailable={this.props.userServiceAvailable}
                onAddNotification={this.props.onAddNotification}
                /> }
            </Toolbar>;

        const card = (
            <Card id="containers-containers" className="containers-containers">
                <CardHeader>
                    <CardTitle><Text component={TextVariants.h2}>{_("Containers")}</Text></CardTitle>
                    <CardActions>{filterRunning}</CardActions>
                </CardHeader>
                <CardBody>
                    <Flex direction={{ default: 'column' }}>
                        {(this.props.containers === null || this.props.pods === null)
                            ? <ListingTable variant='compact'
                                            aria-label={_("Containers")}
                                            emptyCaption={emptyCaption}
                                            columns={columnTitles}
                                            rows={[]} />
                            : Object.keys(partitionedContainers)
                                    .sort((a, b) => {
                                        if (a == "no-pod") return -1;
                                        else if (b == "no-pod") return 1;

                                        // User pods are in front of system ones
                                        if (this.props.pods[a].isSystem !== this.props.pods[b].isSystem)
                                            return this.props.pods[a].isSystem ? 1 : -1;
                                        return this.props.pods[a].Name > this.props.pods[b].Name ? 1 : -1;
                                    })
                                    .map(section => {
                                        const tableProps = {};
                                        const rows = partitionedContainers[section].map(container => {
                                            return this.renderRow(this.props.containersStats, container,
                                                                  this.props.containersDetails[container.Id + container.isSystem.toString()],
                                                                  localImages);
                                        });
                                        let caption;
                                        let podStatus;
                                        if (section !== 'no-pod') {
                                            tableProps['aria-label'] = cockpit.format("Containers of Pod $0", this.props.pods[section].Name);
                                            podStatus = this.props.pods[section].Status;
                                            caption = this.props.pods[section].Name;
                                        } else {
                                            tableProps['aria-label'] = _("Containers");
                                        }
                                        return (
                                            <Card key={'table-' + section}
                                             id={'table-' + (section == "no-pod" ? section : this.props.pods[section].Name)}
                                             isPlain={section == "no-pod"}
                                             isFlat={section != "no-pod"}
                                             className="container-section">
                                                {caption && <CardHeader>
                                                    <CardTitle>
                                                        <span className='pod-name'>{caption}</span>
                                                        <span>{_("pod group")}</span>
                                                    </CardTitle>
                                                    <CardActions className='panel-actions'>
                                                        <Badge isRead className={"ct-badge-pod-" + podStatus.toLowerCase()}>{_(podStatus)}</Badge>
                                                        <Button
                                                          variant="primary"
                                                          className="create-container-in-pod"
                                                          onClick={() => this.setState({ showCreateContainerModal: true, createPod: this.props.pods[section] })}>
                                                            {_("Create container in pod")}
                                                        </Button>
                                                        <PodActions onAddNotification={this.props.onAddNotification} pod={this.props.pods[section]} />
                                                    </CardActions>
                                                </CardHeader>}
                                                <ListingTable variant='compact'
                                                          emptyCaption={section == "no-pod" ? emptyCaption : emptyCaptionPod}
                                                          columns={columnTitles}
                                                          rows={rows}
                                                          {...tableProps} />
                                            </Card>
                                        );
                                    })}
                    </Flex>
                </CardBody>
            </Card>
        );

        return <div ref={this.cardRef}>{card}</div>;
    }
}

export default Containers;
