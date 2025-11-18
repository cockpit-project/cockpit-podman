import React from 'react';

import { Badge } from "@patternfly/react-core/dist/esm/components/Badge";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@patternfly/react-core/dist/esm/components/Card";
import { Content, ContentVariants } from "@patternfly/react-core/dist/esm/components/Content";
import { Divider } from "@patternfly/react-core/dist/esm/components/Divider";
import { DropdownItem } from '@patternfly/react-core/dist/esm/components/Dropdown/index.js';
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { LabelGroup } from "@patternfly/react-core/dist/esm/components/Label";
import { Popover } from "@patternfly/react-core/dist/esm/components/Popover";
import { Toolbar, ToolbarContent, ToolbarItem } from "@patternfly/react-core/dist/esm/components/Toolbar";
import { Tooltip } from "@patternfly/react-core/dist/esm/components/Tooltip";
import { Flex } from "@patternfly/react-core/dist/esm/layouts/Flex";
import { MicrochipIcon, MemoryIcon, PortIcon, VolumeIcon, } from '@patternfly/react-icons';
import { cellWidth, SortByDirection } from '@patternfly/react-table';
import { KebabDropdown } from "cockpit-components-dropdown.jsx";
import { useDialogs, DialogsContext } from "dialogs.jsx";

import cockpit from 'cockpit';
import { ListingPanel } from 'cockpit-components-listing-panel';
import { ListingTable } from "cockpit-components-table";
import * as machine_info from 'machine-info';

import ContainerCheckpointModal from './ContainerCheckpointModal.jsx';
import ContainerCommitModal from './ContainerCommitModal.jsx';
import ContainerDeleteModal from './ContainerDeleteModal.jsx';
import ContainerDetails from './ContainerDetails.jsx';
import ContainerHealthLogs from './ContainerHealthLogs.jsx';
import ContainerIntegration, { renderContainerPublishedPorts, renderContainerVolumes } from './ContainerIntegration.jsx';
import ContainerLogs from './ContainerLogs.jsx';
import ContainerRenameModal from './ContainerRenameModal.jsx';
import ContainerRestoreModal from './ContainerRestoreModal.jsx';
import ContainerTerminal from './ContainerTerminal.jsx';
import ForceRemoveModal from './ForceRemoveModal.jsx';
import { ImageRunModal } from './ImageRunModal.jsx';
import { PodActions } from './PodActions.jsx';
import { PodCreateModal } from './PodCreateModal.jsx';
import PruneUnusedContainersModal from './PruneUnusedContainersModal.jsx';
import * as client from './client.js';
import * as utils from './util.js';

import './Containers.scss';
import '@patternfly/patternfly/utilities/Accessibility/accessibility.css';

const _ = cockpit.gettext;

const ContainerActions = ({ con, container, onAddNotification, localImages, updateContainer, isSystemdService, isDownloading }) => {
    const Dialogs = useDialogs();
    const isRunning = container.State.Status == "running";
    const isPaused = container.State.Status === "paused";

    const deleteContainer = () => {
        if (container.State.Status == "running") {
            const handleForceRemoveContainer = () => {
                const id = container ? container.Id : "";

                return client.delContainer(con, id, true)
                        .catch(ex => {
                            const error = cockpit.format(_("Failed to force remove container $0"), container.Name); // not-covered: OS error
                            onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                        })
                        .finally(() => {
                            Dialogs.close();
                        });
            };

            Dialogs.show(<ForceRemoveModal name={container.Name}
                                           handleForceRemove={handleForceRemoveContainer}
                                           reason={_("Deleting a running container will erase all data in it.")} />);
        } else {
            Dialogs.show(<ContainerDeleteModal con={con}
                                               containerWillDelete={container}
                                               onAddNotification={onAddNotification} />);
        }
    };

    const stopContainer = (force) => {
        const args = {};

        if (force)
            args.t = 0;
        client.postContainer(con, "stop", container.Id, args)
                .catch(ex => {
                    const error = cockpit.format(_("Failed to stop container $0"), container.Name); // not-covered: OS error
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                });
    };

    const stopQuadletContainer = () => {
        utils.systemctl_spawn(["stop", container.Config.Labels.PODMAN_SYSTEMD_UNIT], container.uid === 0);
    };

    const startContainer = () => {
        if (isSystemdService) {
            utils.systemctl_spawn(["start", container.Config.Labels.PODMAN_SYSTEMD_UNIT], container.uid === 0);
        } else {
            client.postContainer(con, "start", container.Id, {})
                    .catch(ex => {
                        const error = cockpit.format(_("Failed to start container $0"), container.Name); // not-covered: OS error
                        onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                    });
        }
    };

    const resumeContainer = () => {
        client.postContainer(con, "unpause", container.Id, {})
                .catch(ex => {
                    const error = cockpit.format(_("Failed to resume container $0"), container.Name); // not-covered: OS error
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                });
    };

    const pauseContainer = () => {
        client.postContainer(con, "pause", container.Id, {})
                .catch(ex => {
                    const error = cockpit.format(_("Failed to pause container $0"), container.Name); // not-covered: OS error
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                });
    };

    const commitContainer = () => {
        Dialogs.show(<ContainerCommitModal con={con}
                                           container={container}
                                           localImages={localImages} />);
    };

    const restartContainer = (force) => {
        const args = {};

        if (force)
            args.t = 0;
        client.postContainer(con, "restart", container.Id, args)
                .catch(ex => {
                    const error = cockpit.format(_("Failed to restart container $0"), container.Name); // not-covered: OS error
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                });
    };

    const restartQuadletContainer = () => {
        utils.systemctl_spawn(["restart", container.Config.Labels.PODMAN_SYSTEMD_UNIT], container.uid === 0);
    };

    const renameContainer = () => {
        if (container.State.Status !== "running") {
            Dialogs.show(<ContainerRenameModal con={con}
                                               container={container}
                                               updateContainer={updateContainer} />);
        }
    };

    const checkpointContainer = () => {
        Dialogs.show(<ContainerCheckpointModal con={con}
                                               containerWillCheckpoint={container}
                                               onAddNotification={onAddNotification} />);
    };

    const restoreContainer = () => {
        Dialogs.show(<ContainerRestoreModal con={con}
                                            containerWillRestore={container}
                                            onAddNotification={onAddNotification} />);
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
        // Allow restarting quadlets from the logged in user and superuser
        if (isSystemdService && [0, null].includes(container.uid)) {
            actions.push(
                <DropdownItem key="stop"
                          onClick={() => stopQuadletContainer()}>
                    {_("Stop")}
                </DropdownItem>,
                <DropdownItem key="restart"
                          onClick={() => restartQuadletContainer()}>
                    {_("Restart")}
                </DropdownItem>,
            );
        } else if (!isSystemdService) {
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
        }

        if (container.uid == 0 && !isPaused && !isSystemdService) {
            if (actions.length > 0)
                actions.push(<Divider key="separator-0" />);

            actions.push(
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
        if (!isSystemdService) {
            addRenameAction();
        }
        if (container.uid == 0 && container.State?.CheckpointPath) {
            actions.push(
                <Divider key="separator-0" />,
                <DropdownItem key="restore"
                              onClick={() => restoreContainer()}>
                    {_("Restore")}
                </DropdownItem>
            );
        }
    } else { // running or paused
        if (!isSystemdService) {
            addRenameAction();
        }
    }

    if (!isSystemdService) {
        actions.push(<Divider key="separator-1" />);
        actions.push(
            <DropdownItem key="commit"
                          onClick={() => commitContainer()}>
                {_("Commit")}
            </DropdownItem>
        );

        actions.push(<Divider key="separator-2" />);
        actions.push(
            <DropdownItem key="delete"
                      className="pf-m-danger"
                      onClick={deleteContainer}>
                {_("Delete")}
            </DropdownItem>
        );
    }

    return <KebabDropdown position="right" dropdownItems={actions} isDisabled={isDownloading} />;
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

const ContainerOverActions = ({ handlePruneUnusedContainers, unusedContainers }) => {
    const actions = [
        <DropdownItem key="prune-unused-containers"
                            id="prune-unused-containers-button"
                            component="button"
                            className="pf-m-danger btn-delete"
                            onClick={() => handlePruneUnusedContainers()}
                            isDisabled={unusedContainers.length === 0}>
            {_("Prune unused containers")}
        </DropdownItem>,
    ];

    return <KebabDropdown toggleButtonId="containers-actions-dropdown" position="right" dropdownItems={actions} />;
};

class Containers extends React.Component {
    static contextType = DialogsContext;

    constructor(props) {
        super(props);
        this.state = {
            width: 0,
            memTotal: 0,
            downloadingContainers: [],
            showPruneUnusedContainersModal: false,
        };
        this.renderRow = this.renderRow.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);
        this.podStats = this.podStats.bind(this);
        this.filterContainers = this.filterContainers.bind(this);

        this.cardRef = React.createRef();

        onDownloadContainer = onDownloadContainer.bind(this);
        onDownloadContainerFinished = onDownloadContainerFinished.bind(this);

        machine_info.cpu_ram_info()
                .then(info => this.setState({ memTotal: info.memory }));

        window.addEventListener('resize', this.onWindowResize);
    }

    componentDidMount() {
        this.onWindowResize();
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.onWindowResize);
    }

    renderRow(containersStats, container, localImages) {
        const containerStats = containersStats[container.key];
        const image = container.ImageName;
        const isToolboxContainer = container.Config?.Labels?.["com.github.containers.toolbox"] === "true";
        const isDistroboxContainer = container.Config?.Labels?.manager === "distrobox";
        const isSystemdService = utils.is_systemd_service(container.Config);
        let localized_health = null;

        // this needs to get along with stub containers from image run dialog, where most properties don't exist yet
        // HACK: Podman renamed `Healthcheck` to `Health` randomly
        // https://github.com/containers/podman/commit/119973375
        const healthcheck = container.State?.Health?.Status ?? container.State?.Healthcheck?.Status; // not-covered: only on old version
        const status = container.State?.Status ?? ""; // not-covered: race condition

        let proc = "";
        let mem = "";
        if (this.props.cgroupVersion == 'v1' && container.uid !== 0 && status == 'running') { // not-covered: only on old version
            proc = <div><abbr title={_("not available")}>{_("n/a")}</abbr></div>;
            mem = <div><abbr title={_("not available")}>{_("n/a")}</abbr></div>;
        }
        if (containerStats && status === "running") {
            // container.HostConfig.Memory (0 by default), containerStats.MemUsage
            if (containerStats.CPU != undefined)
                proc = <div className="ct-numeric-column">{containerStats.CPU.toFixed(2) + "%"}</div>;
            if (Number.isInteger(containerStats.MemUsage) && this.state.memTotal) {
                // the primary view is how much of the host's memory a container uses, for comparability
                const mem_pct = Math.round(containerStats.MemUsage / this.state.memTotal * 100);
                const mem_items = [
                    <span key="pct">{cockpit.format("$0%", mem_pct)}</span>,
                    <small key="abs">{cockpit.format_bytes(containerStats.MemUsage)}</small>
                ];

                // is there a configured limit?
                if (container.HostConfig?.Memory) {
                    const limit_pct = Math.round(containerStats.MemUsage / container.HostConfig.Memory * 100);
                    mem_items.push(
                        <small key="limit">
                            { cockpit.format(
                                _("$0% of $1 limit"),
                                limit_pct,
                                cockpit.format_bytes(container.HostConfig.Memory)) }
                        </small>
                    );
                }

                mem = <div className="container-block ct-numeric-column">{mem_items}</div>;
            }
        }
        const info_block = (
            <div className="container-block">
                <Flex alignItems={{ default: 'alignItemsCenter' }}>
                    <span className="container-name">{container.Name}</span>
                    {isToolboxContainer && <Badge className='ct-badge-toolbox'>toolbox</Badge>}
                    {isDistroboxContainer && <Badge className='ct-badge-distrobox'>distrobox</Badge>}
                    {isSystemdService && <Badge className='ct-badge-service'>{_("service")}</Badge>}
                </Flex>
                <small>{image}</small>
                <small>{utils.quote_cmdline(container.Config?.Cmd)}</small>
            </div>
        );

        let containerStateClass = "ct-badge-container-" + status.toLowerCase();
        if (container.isDownloading)
            containerStateClass += " downloading";

        const containerState = status.charAt(0).toUpperCase() + status.slice(1);

        const state = [<Badge key={containerState} isRead className={containerStateClass}>{_(containerState)}</Badge>]; // States are defined in util.js
        if (healthcheck) {
            localized_health = localize_health(healthcheck);
            if (localized_health)
                state.push(<Badge key={healthcheck} isRead className={"ct-badge-container-" + healthcheck}>{localized_health}</Badge>);
        }

        const user = this.props.users.find(user => user.uid === container.uid);
        cockpit.assert(user, `User not found for container uid ${container.uid}`);

        const columns = [
            { title: info_block, sortKey: container.Name ?? container.Id },
            {
                title: (container.uid === 0) ? _("system") : <div><span className="ct-grey-text">{_("user:")} </span>{user.name}</div>,
                props: { modifier: "nowrap" },
                sortKey: container.key,
            },
            { title: proc, props: { modifier: "nowrap" }, sortKey: containerState === "Running" ? containerStats?.CPU ?? -1 : -1 },
            { title: mem, props: { modifier: "nowrap" }, sortKey: containerStats?.MemUsage ?? -1 },
            { title: <LabelGroup isVertical>{state}</LabelGroup>, sortKey: containerState },
        ];

        columns.push({
            title: <ContainerActions con={user.con}
                                     container={container}
                                     onAddNotification={this.props.onAddNotification}
                                     localImages={localImages}
                                     updateContainer={this.props.updateContainer}
                                     isSystemdService={isSystemdService}
                                     isDownloading={container.isDownloading} />,
            props: { className: "pf-v6-c-table__action" }
        });

        const tty = !!container.Config?.Tty;

        const tabs = [];
        if (container.State && user.con !== null) {
            tabs.push({
                name: _("Details"),
                renderer: ContainerDetails,
                data: { container }
            });

            if (!container.isDownloading) {
                tabs.push({
                    name: _("Integration"),
                    renderer: ContainerIntegration,
                    data: { container, localImages }
                });
                tabs.push({
                    name: _("Logs"),
                    renderer: ContainerLogs,
                    data: {
                        containerId: container.Id,
                        containerStatus: container.State.Status,
                        width: this.state.width,
                        uid: container.uid,
                        systemd_unit: container.Config?.Labels?.PODMAN_SYSTEMD_UNIT,
                    }
                });
                tabs.push({
                    name: _("Console"),
                    renderer: ContainerTerminal,
                    data: { con: user.con, containerId: container.Id, containerStatus: container.State.Status, width: this.state.width, uid: container.uid, tty }
                });
            }
        }

        if (healthcheck) {
            tabs.push({
                name: _("Health check"),
                renderer: ContainerHealthLogs,
                data: { con: user.con, container, onAddNotification: this.props.onAddNotification, state: localized_health }
            });
        }

        return {
            expandedContent: <ListingPanel colSpan='4' tabRenderers={tabs} />,
            columns,
            initiallyExpanded: document.location.hash.substring(1) === container.Id,
            props: {
                key: container.key,
                "data-row-id": container.key,
                "data-started-at": container.State?.StartedAt,
                "data-row-name": `${container.uid === null ? 'user' : container.uid}-${container.Name}`
            },
        };
    }

    onWindowResize() {
        this.setState({ width: this.cardRef.current.clientWidth });
    }

    podStats(pod) {
        const { containersStats } = this.props;
        // when no containers exists pod.Containers is null
        if (!containersStats || !pod.Containers) {
            return null;
        }

        // As podman does not provide per pod memory/cpu statistics we do the following:
        // - add up CPU usage to display total CPU use of all containers in the pod
        // - add up memory usage so it displays the total memory of the pod.
        let cpu = 0;
        let mem = 0;
        for (const container of pod.Containers) {
            const containerStats = containersStats[utils.makeKey(pod.uid, container.Id)];
            if (!containerStats)
                continue;

            if (containerStats.CPU != undefined) {
                cpu += containerStats.CPU;
            }
            if (containerStats.MemUsage != undefined) {
                mem += containerStats.MemUsage;
            }
        }

        return {
            cpu: cpu.toFixed(2),
            mem,
        };
    }

    renderPodDetails(pod, podStatus) {
        const podStats = this.podStats(pod);
        const infraContainer = this.props.containers[utils.makeKey(pod.uid, pod.InfraId)];
        const numPorts = Object.keys(infraContainer?.NetworkSettings?.Ports ?? {}).length;

        return (
            <>
                {podStats && podStatus === "Running" &&
                    <>
                        <Flex className='pod-stat' spaceItems={{ default: 'spaceItemsSm' }}>
                            <Tooltip content={_("CPU")}>
                                <MicrochipIcon />
                            </Tooltip>
                            <Content component={ContentVariants.p} className="pf-v6-u-hidden-on-sm">{_("CPU")}</Content>
                            <Content component={ContentVariants.p} className="pod-cpu">{podStats.cpu}%</Content>
                        </Flex>
                        <Flex className='pod-stat' spaceItems={{ default: 'spaceItemsSm' }}>
                            <Tooltip content={_("Memory")}>
                                <MemoryIcon />
                            </Tooltip>
                            <Content component={ContentVariants.p} className="pf-v6-u-hidden-on-sm">{_("Memory")}</Content>
                            <Content component={ContentVariants.p} className="pod-memory">{cockpit.format_bytes(podStats.mem)}</Content>
                        </Flex>
                    </>
                }
                {infraContainer &&
                <>
                    {numPorts > 0 &&
                        <Tooltip content={_("Click to see published ports")}>
                            <Popover
                              enableFlip
                              bodyContent={renderContainerPublishedPorts(infraContainer.NetworkSettings.Ports)}
                            >
                                <Button size="sm" variant="link" className="pod-details-button pod-details-ports-btn"
                                        icon={<PortIcon className="pod-details-button-color" />}
                                >
                                    {numPorts}
                                    <Content component={ContentVariants.p} className="pf-v6-u-hidden-on-sm">{_("ports")}</Content>
                                </Button>
                            </Popover>
                        </Tooltip>
                    }
                    {infraContainer.Mounts && infraContainer.Mounts.length !== 0 &&
                    <Tooltip content={_("Click to see volumes")}>
                        <Popover
                      enableFlip
                      bodyContent={renderContainerVolumes(infraContainer.Mounts)}
                        >
                            <Button size="sm" variant="link" className="pod-details-button pod-details-volumes-btn"
                            icon={<VolumeIcon className="pod-details-button-color" />}
                            >
                                {infraContainer.Mounts.length}
                                <Content component={ContentVariants.p} className="pf-v6-u-hidden-on-sm">{_("volumes")}</Content>
                            </Button>
                        </Popover>
                    </Tooltip>
                    }
                </>
                }
            </>
        );
    }

    onOpenPruneUnusedContainersDialog = () => {
        this.setState({ showPruneUnusedContainersModal: true });
    };

    filterContainers = (containers) => {
        let filtered = [];
        filtered = Object.keys(containers).filter(id => !(this.props.filter == "running") || ["running", "restarting"].includes(this.props.containers[id]?.State?.Status));

        const filter_by_text = (lcf, id) => {
            const container = containers[id];
            const systemd_unit_match = container.Config?.Labels?.PODMAN_SYSTEMD_UNIT?.toLowerCase().indexOf(lcf) >= 0;
            const name_match = container.Name.toLowerCase().indexOf(lcf) >= 0;
            const image_match = container.ImageName.toLowerCase().indexOf(lcf) >= 0;

            if (container.Pod) {
                const podKey = utils.makeKey(container.uid, container.Pod);
                const pod = this.props.pods[podKey] || this.props.quadletPods[podKey];
                const pod_match = pod.Name.toLowerCase().indexOf(lcf) >= 0 || pod.Labels?.PODMAN_SYSTEMD_UNIT?.toLowerCase().indexOf(lcf) >= 0;
                return name_match || systemd_unit_match || image_match || pod_match;
            } else {
                return name_match || systemd_unit_match || image_match;
            }
        };

        if (this.props.ownerFilter !== "all") {
            filtered = filtered.filter(id => {
                if (this.props.ownerFilter === "user")
                    return containers[id].uid === null;
                return containers[id].uid === this.props.ownerFilter;
            });
        }

        if (this.props.textFilter.length > 0) {
            const lcf = this.props.textFilter.toLowerCase();
            filtered = filtered.filter(id => filter_by_text(lcf, id));
        }

        // Remove infra and service containers
        filtered = filtered.filter(id => !containers[id].IsInfra && !containers[id].IsService);

        const getHealth = id => {
            const state = containers[id]?.State;
            return state?.Health?.Status || state?.Healthcheck?.Status;
        };

        filtered.sort((a, b) => {
            // Show unhealthy containers first
            const a_health = getHealth(a);
            const b_health = getHealth(b);
            if (a_health !== b_health) {
                if (a_health === "unhealthy")
                    return -1;
                if (b_health === "unhealthy")
                    return 1;
            }
            // User containers are in front of system ones
            if (containers[a].uid !== containers[b].uid)
                return (containers[a].uid === 0) ? 1 : -1;
            return containers[a].Name > containers[b].Name ? 1 : -1;
        });

        return filtered;
    };

    render() {
        const Dialogs = this.context;
        const columnTitles = [
            { title: _("Container"), transforms: [cellWidth(20)], sortable: true },
            { title: _("Owner"), sortable: true },
            { title: _("CPU"), sortable: true, props: { className: 'ct-numeric-column' } },
            { title: _("Memory"), sortable: true, props: { className: 'ct-numeric-column' } },
            { title: _("State"), sortable: true },
            { title: "", sortable: false, props: { screenReaderText: _("Actions") } },
        ];
        /** @type Record<string, string[]> */
        const partitionedContainers = { 'no-pod': [] };
        const unusedContainers = [];
        const isLoaded = this.props.containers !== null && this.props.pods !== null && this.props.quadletContainers !== null && this.props.quadletPods !== null;
        let pods;

        let emptyCaption = _("No containers");
        const emptyCaptionPod = _("No containers in this pod");
        if (!isLoaded)
            emptyCaption = _("Loading...");
        else if (this.props.textFilter.length > 0)
            emptyCaption = _("No containers that match the current filter");
        else if (this.props.filter == "running")
            emptyCaption = _("No running containers");

        if (isLoaded) {
            const filtered = this.filterContainers(this.props.containers);
            pods = { ...this.props.pods };
            /**
             * Mapping of systemd service name to pod ID.
             * @type Record<string, string>
             **/
            const podServiceNameIdMap = {};

            Object.values(this.props.pods).forEach(pod => {
                const service_name = pod?.Labels?.PODMAN_SYSTEMD_UNIT;
                if (service_name) {
                    const key = utils.makeKey(pod.uid, service_name);
                    podServiceNameIdMap[key] = utils.makeKey(pod.uid, pod.Id);
                }
            });

            // Add inactive quadlet pods to the `pods` state
            Object.keys(this.props.quadletPods).forEach(key => {
                const values = this.props.quadletPods[key];
                if (!(utils.makeKey(values.uid, values.Labels.PODMAN_SYSTEMD_UNIT) in podServiceNameIdMap)) {
                    pods[key] = values;
                }
            });

            Object.keys(pods).forEach(pod => { partitionedContainers[pod] = [] });

            // Set of running quadlets ($id-$name.service)
            const running_quadlets = new Set();
            filtered.forEach(id => {
                const container = this.props.containers[id];
                if (container) {
                    (partitionedContainers[container.Pod ? utils.makeKey(container.uid, container.Pod) : 'no-pod'] || []).push(container);
                    const service_name = container?.Config?.Labels?.PODMAN_SYSTEMD_UNIT;
                    if (service_name)
                        running_quadlets.add(utils.makeKey(container.uid, service_name));
                }
            });

            // Combine the podman containers with inactive quadlets, active
            // quadlets have a running container or pod associated with them
            const filteredQuadlets = this.filterContainers(this.props.quadletContainers);
            filteredQuadlets.forEach(id => {
                if (!running_quadlets.has(id)) {
                    const cont = this.props.quadletContainers[id];
                    const podKey = utils.makeKey(cont.uid, cont.Pod);
                    // Quadlet container with a pod
                    if (cont.Pod && !(podKey in podServiceNameIdMap)) {
                        // Containers and pod state aren't updated in sync
                        if (podKey in partitionedContainers)
                            partitionedContainers[podKey].push(cont);
                    // Stopped container but pod is running, find the pod ID via our mapping
                    } else if (cont.Pod && podKey in podServiceNameIdMap) {
                        partitionedContainers[podServiceNameIdMap[podKey]].push(cont);
                    } else {
                        partitionedContainers['no-pod'].push(cont);
                    }
                }
            });

            // Append downloading containers
            this.state.downloadingContainers.forEach(cont => {
                partitionedContainers['no-pod'].push(cont);
            });

            // Apply filters to pods
            Object.keys(partitionedContainers).forEach(section => {
                const lcf = this.props.textFilter.toLowerCase();
                if (section != "no-pod") {
                    const pod = pods[section];
                    if ((this.props.filter == "running" && pod.Status != "Running") ||
                        // If nor the pod name nor any container inside the pod fit the filter, hide the whole pod
                        (!partitionedContainers[section].length && (pod.Name.toLowerCase().indexOf(lcf) < 0 ||
                          pod.Labels?.PODMAN_SYSTEMD_UNIT?.toLowerCase().indexOf(lcf) < 0)) ||
                        (this.props.ownerFilter !== "all" &&
                         ((this.props.ownerFilter === "user" && pod.uid !== null) ||
                            (this.props.ownerFilter !== "user" && pod.uid !== this.props.ownerFilter))))
                        delete partitionedContainers[section];
                }
            });
            // If there are pods to show and the generic container list is empty don't show  it at all
            if (Object.keys(partitionedContainers).length > 1 && !partitionedContainers["no-pod"].length)
                delete partitionedContainers["no-pod"];

            const prune_states = ["created", "configured", "stopped", "exited"];
            for (const containerid of Object.keys(this.props.containers)) {
                const container = this.props.containers[containerid];
                // Ignore pods and running containers
                if (!prune_states.includes(container?.State?.Status) || container.Pod)
                    continue;

                unusedContainers.push({
                    id: container.Id,
                    name: container.Name,
                    key: container.key,
                    created: container.Created,
                    uid: container.uid,
                });
            }
        }

        // Convert to the search result output
        let localImages = null;
        let nonIntermediateImages = null;
        if (this.props.images) {
            localImages = Object.keys(this.props.images).map(id => {
                const img = this.props.images[id];
                img.Index = img.RepoTags?.[0] ? img.RepoTags[0].split('/')[0] : "";
                img.Name = utils.image_name(img);
                img.toString = function imgToString() { return this.Name };
                return img;
            }, []);
            nonIntermediateImages = localImages.filter(img => img.Index !== "");
        }

        const createContainer = (inPod) => {
            if (nonIntermediateImages)
                Dialogs.show(
                    <utils.PodmanInfoContext.Consumer>
                        {(podmanInfo) => (
                            <DialogsContext.Consumer>
                                {(Dialogs) => (
                                    <ImageRunModal users={this.props.users}
                                                   localImages={nonIntermediateImages}
                                                   pod={inPod}
                                                   onAddNotification={this.props.onAddNotification}
                                                   podmanInfo={podmanInfo}
                                                   dialogs={Dialogs} />
                                )}
                            </DialogsContext.Consumer>
                        )}
                    </utils.PodmanInfoContext.Consumer>);
        };

        const createPod = () => {
            Dialogs.show(<PodCreateModal
                users={this.props.users}
                onAddNotification={this.props.onAddNotification} />);
        };

        const filterRunning = (
            <Toolbar>
                <ToolbarContent className="containers-containers-toolbarcontent">
                    <ToolbarItem alignSelf="center" variant="label" htmlFor="containers-containers-filter">
                        {_("Show")}
                    </ToolbarItem>
                    <ToolbarItem>
                        <FormSelect id="containers-containers-filter" value={this.props.filter} onChange={(_, value) => this.props.handleFilterChange(value)}>
                            <FormSelectOption value='all' label={_("All")} />
                            <FormSelectOption value='running' label={_("Only running")} />
                        </FormSelect>
                    </ToolbarItem>
                    <Divider orientation={{ default: "vertical" }} />
                    <ToolbarItem>
                        <Button variant="secondary" key="create-new-pod-action"
                                id="containers-containers-create-pod-btn"
                                onClick={() => createPod()}>
                            {_("Create pod")}
                        </Button>
                    </ToolbarItem>
                    <ToolbarItem>
                        <Button variant="primary" key="get-new-image-action"
                                id="containers-containers-create-container-btn"
                                isDisabled={nonIntermediateImages === null}
                                onClick={() => createContainer(null)}>
                            {_("Create container")}
                        </Button>
                    </ToolbarItem>
                    <ToolbarItem>
                        <ContainerOverActions unusedContainers={unusedContainers} handlePruneUnusedContainers={this.onOpenPruneUnusedContainersDialog} />
                    </ToolbarItem>
                </ToolbarContent>
            </Toolbar>
        );

        const sortRows = (rows, direction, idx) => {
            // CPU / Memory /States
            const isNumeric = idx == 2 || idx == 3 || idx == 4;
            const stateOrderMapping = {};
            utils.states.forEach((elem, index) => {
                stateOrderMapping[elem] = index;
            });
            const sortedRows = rows.sort((a, b) => {
                let aitem = a.columns[idx].sortKey ?? a.columns[idx].title;
                let bitem = b.columns[idx].sortKey ?? b.columns[idx].title;
                // Sort the states based on the order defined in utils. so Running first.
                if (idx === 4) {
                    aitem = stateOrderMapping[aitem];
                    bitem = stateOrderMapping[bitem];
                }
                if (isNumeric) {
                    return bitem - aitem;
                } else {
                    return aitem.localeCompare(bitem);
                }
            });
            return direction === SortByDirection.asc ? sortedRows : sortedRows.reverse();
        };

        const card = (
            <Card id="containers-containers" className="containers-containers">
                <CardHeader actions={{ actions: filterRunning }}>
                    <CardTitle><Content component={ContentVariants.h1}>{_("Containers")}</Content></CardTitle>
                </CardHeader>
                <CardBody>
                    <Flex direction={{ default: 'column' }}>
                        {(!isLoaded)
                            ? <ListingTable variant='compact'
                                            aria-label={_("Containers")}
                                            emptyCaption={emptyCaption}
                                            columns={columnTitles}
                                            sortMethod={sortRows}
                                            rows={[]}
                                            sortBy={{ index: 0, direction: SortByDirection.asc }} />
                            : Object.keys(partitionedContainers)
                                    .sort((a, b) => {
                                        if (a == "no-pod") return -1;
                                        else if (b == "no-pod") return 1;

                                        // User pods are in front of system ones
                                        if (pods[a].uid !== pods[b].uid)
                                            return pods[a].uid === 0 ? 1 : -1;
                                        return pods[a].Name > pods[b].Name ? 1 : -1;
                                    })
                                    .map(section => {
                                        const tableProps = {};
                                        const rows = partitionedContainers[section].map(container => {
                                            return this.renderRow(this.props.containersStats, container,
                                                                  localImages);
                                        });
                                        let caption;
                                        let podStatus;
                                        let pod;
                                        let isPodService = false;
                                        let con;
                                        if (section !== 'no-pod') {
                                            pod = pods[section];
                                            con = this.props.users.find(u => u.uid === pod.uid).con;
                                            tableProps['aria-label'] = cockpit.format("Containers of pod $0", pod.Name);
                                            podStatus = pod.Status;
                                            isPodService = Boolean(pod.Labels?.PODMAN_SYSTEMD_UNIT);
                                            caption = pod.Name;
                                        } else {
                                            tableProps['aria-label'] = _("Containers");
                                        }

                                        const actions = caption && (
                                            <>
                                                <Badge isRead className={"ct-badge-pod-" + podStatus.toLowerCase()}>{_(podStatus)}</Badge>
                                                {!isPodService &&
                                                <Button variant="secondary"
                                                        className="create-container-in-pod"
                                                        isDisabled={nonIntermediateImages === null}
                                                        onClick={() => createContainer(this.props.pods[section])}>
                                                    {_("Create container in pod")}
                                                </Button>}
                                                <PodActions con={con}
                                                            onAddNotification={this.props.onAddNotification}
                                                            pod={pod}
                                                            isPodService={isPodService}
                                                />
                                            </>
                                        );
                                        return (
                                            <Card key={'table-' + section}
                                             id={'table-' + (section == "no-pod" ? section : pods[section].Name)}
                                             isPlain={section == "no-pod"}
                                             className="container-pod"
                                             isClickable
                                             isSelectable>
                                                {caption && <CardHeader actions={{ actions, className: "panel-actions" }}>
                                                    <CardTitle>
                                                        <Flex justifyContent={{ default: 'justifyContentFlexStart' }}>
                                                            <h3 className='pod-name'>{caption}</h3>
                                                            <span>{_("pod")}</span>
                                                            {isPodService && <Badge className='ct-badge-service'>{_("service")}</Badge>}
                                                            {this.renderPodDetails(pods[section], podStatus)}
                                                        </Flex>
                                                    </CardTitle>
                                                </CardHeader>}
                                                <ListingTable variant='compact'
                                                          emptyCaption={section == "no-pod" ? emptyCaption : emptyCaptionPod}
                                                          columns={columnTitles}
                                                          sortMethod={sortRows}
                                                          rows={rows}
                                                          {...tableProps} />
                                            </Card>
                                        );
                                    })}
                    </Flex>
                    {this.state.showPruneUnusedContainersModal &&
                    <PruneUnusedContainersModal
                      close={() => this.setState({ showPruneUnusedContainersModal: false })}
                      unusedContainers={unusedContainers}
                      onAddNotification={this.props.onAddNotification}
                      users={this.props.users} /> }
                </CardBody>
            </Card>
        );

        return <div ref={this.cardRef}>{card}</div>;
    }
}

export default Containers;
