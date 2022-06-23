import React, { useState } from 'react';
import {
    Badge,
    Button,
    Card, CardBody, CardHeader, CardTitle, CardActions,
    Divider,
    Dropdown, DropdownItem, DropdownSeparator,
    Flex,
    KebabToggle,
    LabelGroup,
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
import ContainerHealthLogs from './ContainerHealthLogs.jsx';
import ContainerDeleteModal from './ContainerDeleteModal.jsx';
import ContainerCheckpointModal from './ContainerCheckpointModal.jsx';
import ContainerRestoreModal from './ContainerRestoreModal.jsx';
import ForceRemoveModal from './ForceRemoveModal.jsx';
import * as utils from './util.js';
import * as client from './client.js';
import ContainerCommitModal from './ContainerCommitModal.jsx';
import ContainerRenameModal from './ContainerRenameModal.jsx';
import { useDialogs, DialogsContext } from "dialogs.jsx";

import './Containers.scss';
import { ImageRunModal } from './ImageRunModal.jsx';
import { PodActions } from './PodActions.jsx';

const _ = cockpit.gettext;

const ContainerActions = ({ container, healthcheck, onAddNotification, version, localImages, updateContainerAfterEvent }) => {
    const Dialogs = useDialogs();
    const [isActionsKebabOpen, setActionsKebabOpen] = useState(false);
    const isRunning = container.State == "running";
    const isPaused = container.State === "paused";

    const deleteContainer = (event) => {
        setActionsKebabOpen(false);

        if (container.State == "running") {
            const handleForceRemoveContainer = () => {
                const id = container ? container.Id : "";

                return client.delContainer(container.isSystem, id, true)
                        .catch(ex => {
                            const error = cockpit.format(_("Failed to force remove container $0"), container.Names);
                            onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                            throw ex;
                        })
                        .finally(() => {
                            Dialogs.close();
                        });
            };

            Dialogs.show(<ForceRemoveModal name={container.Names}
                                           handleForceRemove={handleForceRemoveContainer}
                                           reason={_("Container is currently running.")} />);
        } else {
            const handleRemoveContainer = () => {
                const id = container ? container.Id : "";

                Dialogs.close();
                client.delContainer(container.isSystem, id, false)
                        .catch(ex => {
                            const error = cockpit.format(_("Failed to remove container $0"), container.Names);
                            onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                        });
            };

            Dialogs.show(<ContainerDeleteModal containerWillDelete={container}
                                               handleRemoveContainer={handleRemoveContainer} />);
        }
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

    const commitContainer = () => {
        setActionsKebabOpen(false);

        Dialogs.show(<ContainerCommitModal container={container}
                                           version={version}
                                           localImages={localImages} />);
    };

    const runHealthcheck = () => {
        setActionsKebabOpen(false);

        client.runHealthcheck(container.isSystem, container.Id)
                .catch(ex => {
                    const error = cockpit.format(_("Failed to run health check on container $0"), container.Names);
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
        setActionsKebabOpen(false);
        if (container.State !== "running" ||
            version.localeCompare("3.0.1", undefined, { numeric: true, sensitivity: 'base' }) >= 0) {
            Dialogs.show(<ContainerRenameModal container={container}
                                               version={version}
                                               updateContainerAfterEvent={updateContainerAfterEvent} />);
        }
    };

    const checkpointContainer = () => {
        setActionsKebabOpen(false);

        const handleCheckpointContainer = (args) => {
            client.postContainer(container.isSystem, "checkpoint", container.Id, args)
                    .catch(ex => {
                        const error = cockpit.format(_("Failed to checkpoint container $0"), container.Names);
                        onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                    })
                    .finally(() => {
                        Dialogs.close();
                    });
        };

        Dialogs.show(<ContainerCheckpointModal handleCheckpointContainer={handleCheckpointContainer}
                                               containerWillCheckpoint={container} />);
    };

    const restoreContainer = () => {
        setActionsKebabOpen(false);

        const handleRestoreContainer = (args) => {
            client.postContainer(container.isSystem, "restore", container.Id, args)
                    .catch(ex => {
                        const error = cockpit.format(_("Failed to restore container $0"), container.Names);
                        onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                    })
                    .finally(() => {
                        Dialogs.close();
                    });
        };

        Dialogs.show(<ContainerRestoreModal handleRestoreContainer={handleRestoreContainer}
                                            containerWillCheckpoint={container} />);
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
                              onClick={() => checkpointContainer()}>
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
                              onClick={() => restoreContainer()}>
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
                      onClick={() => commitContainer()}>
            {_("Commit")}
        </DropdownItem>
    );

    if (isRunning && healthcheck !== "") {
        actions.push(<DropdownSeparator key="separator-1-1" />);
        actions.push(
            <DropdownItem key="healthcheck"
                          onClick={() => runHealthcheck()}>
                {_("Run health check")}
            </DropdownItem>
        );
    }

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

    return kebab;
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

const localize_health = (state) => {
    if (state === "healthy")
        return _("Healthy");
    else if (state === "unhealthy")
        return _("Unhealthy");
    else if (state === "starting")
        return _("Checking health");
    else
        console.error("Unexpected health check status", state);
    return null;
};

class Containers extends React.Component {
    static contextType = DialogsContext;

    constructor(props) {
        super(props);
        this.state = {
            width: 0,
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
        let healthcheck = "";
        let localized_health = null;

        // HACK: Podman renamed `Healthcheck` to `Health` randomly
        // https://github.com/containers/podman/commit/119973375
        if (containerDetail)
            healthcheck = containerDetail.State.Health ? containerDetail.State.Health.Status : containerDetail.State.Healthcheck.Status;

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
        if (container.isDownloading)
            containerStateClass += " downloading";

        const containerState = container.State.charAt(0).toUpperCase() + container.State.slice(1);

        const state = [<Badge key={containerState} isRead className={containerStateClass}>{_(containerState)}</Badge>]; // States are defined in util.js
        if (healthcheck) {
            localized_health = localize_health(healthcheck);
            if (localized_health)
                state.push(<Badge key={healthcheck} isRead className={"ct-badge-container-" + healthcheck}>{localized_health}</Badge>);
        }

        const columns = [
            { title: info_block },
            { title: container.isSystem ? _("system") : <div><span className="ct-grey-text">{_("user:")} </span>{this.props.user}</div>, props: { modifier: "nowrap" } },
            { title: proc, props: { modifier: "nowrap" } },
            { title: mem, props: { modifier: "nowrap" } },
            { title: <LabelGroup isVertical>{state}</LabelGroup> },
        ];

        if (!container.isDownloading) {
            columns.push({ title: <ContainerActions version={this.props.version} container={container} healthcheck={healthcheck} onAddNotification={this.props.onAddNotification} localImages={localImages} updateContainerAfterEvent={this.props.updateContainerAfterEvent} />, props: { className: "pf-c-table__action" } });
        }

        const tty = containerDetail ? !!containerDetail.Config.Tty : undefined;

        const tabs = [{
            name: _("Details"),
            renderer: ContainerDetails,
            data: { container: container, containerDetail: containerDetail }
        }, {
            name: _("Logs"),
            renderer: ContainerLogs,
            data: { containerId: container.Id, containerStatus: container.State, width: this.state.width, system: container.isSystem }
        }, {
            name: _("Console"),
            renderer: ContainerTerminal,
            data: { containerId: container.Id, containerStatus: container.State, width: this.state.width, system: container.isSystem, tty: tty }
        }];

        if (healthcheck) {
            tabs.push({
                name: _("Health check"),
                renderer: ContainerHealthLogs,
                data: { container: container, containerDetail: containerDetail, onAddNotification: this.props.onAddNotification, state: localized_health }
            });
        }

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
        const Dialogs = this.context;
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
                // Show unhealthy containers first
                if (this.props.containersDetails[a] && this.props.containersDetails[b]) {
                    const a_health = this.props.containersDetails[a].State.Health || this.props.containersDetails[a].State.Healthcheck;
                    const b_health = this.props.containersDetails[b].State.Health || this.props.containersDetails[b].State.Healthcheck;
                    if (a_health.Status !== b_health.Status) {
                        if (a_health.Status === "unhealthy")
                            return -1;
                        if (b_health.Status === "unhealthy")
                            return 1;
                    }
                }
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

        const createContainer = (inPod) => {
            if (localImages)
                Dialogs.show(<ImageRunModal user={this.props.user}
                                            localImages={localImages}
                                            pod={inPod}
                                            registries={this.props.registries}
                                            selinuxAvailable={this.props.selinuxAvailable}
                                            podmanRestartAvailable={this.props.podmanRestartAvailable}
                                            systemServiceAvailable={this.props.systemServiceAvailable}
                                            userServiceAvailable={this.props.userServiceAvailable}
                                            onAddNotification={this.props.onAddNotification} />);
        };

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
                                onClick={() => createContainer(null)}>
                            {_("Create container")}
                        </Button>
                    </ToolbarItem>
                </ToolbarContent>
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
                                                        <Button variant="primary"
                                                                className="create-container-in-pod"
                                                                isDisabled={localImages === null}
                                                                onClick={() => createContainer(this.props.pods[section])}>
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
