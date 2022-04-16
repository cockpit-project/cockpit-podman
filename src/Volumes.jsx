import React, { useState } from 'react';
import {
    Card, CardBody, CardHeader,
    Dropdown, DropdownItem,
    Flex, FlexItem,
    ExpandableSection,
    KebabToggle,
    Text, TextVariants,
    ToolbarItem, Button
} from '@patternfly/react-core';

import cockpit from 'cockpit';
import { ListingTable } from "cockpit-components-table.jsx";
import { ListingPanel } from 'cockpit-components-listing-panel.jsx';
import VolumeDetails from './VolumeDetails.jsx';
import { VolumeDeleteModal } from './VolumeDeleteModal.jsx';
import PruneUnusedVolumesModal from './PruneUnusedVolumesModal.jsx';
import ForceRemoveModal from './ForceRemoveModal.jsx';
import { VolumeCreateModal } from './VolumeCreateModal.jsx';
import * as client from './client.js';
import * as utils from './util.js';

import './Volumes.css';
import '@patternfly/react-styles/css/utilities/Sizing/sizing.css';

const _ = cockpit.gettext;

class Volumes extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isExpanded: false,
            showVolumeCreateModal: false,
        };

        this.renderRow = this.renderRow.bind(this);
    }

    onOpenPruneUnusedVolumesDialog = () => {
        this.setState({ showPruneUnusedVolumesModal: true });
    }

    calculateStats = () => {
        const { volumes, volumeContainerList } = this.props;
        const unusedVolumes = [];
        const volumeStats = {
            volumesTotal: 0,
            unusedTotal: 0,
        };

        if (volumeContainerList === null) {
            return { volumeStats, unusedVolumes };
        }

        if (volumes !== null) {
            Object.keys(volumes).forEach(name => {
                const volume = volumes[name];
                volumeStats.volumesTotal += 1;

                const usedBy = volumeContainerList[volume.Name + volume.isSystem.toString()];
                if (usedBy === undefined) {
                    volumeStats.unusedTotal += 1;
                    unusedVolumes.push(volume);
                }
            });
        }

        return { volumeStats, unusedVolumes };
    }

    renderRow(volume) {
        const tabs = [];

        const columns = [
            { title: volume.Name.length === 64 ? utils.truncate_id(volume.Name) : volume.Name },
            { title: <small>{ volume.Mountpoint }</small>, props: { modifier: "breakWord" } },
            { title: volume.isSystem ? _("system") : <div><span className="ct-grey-text">{_("user:")} </span>{this.props.user}</div>, props: { modifier: "nowrap" } },
            { title: utils.localize_date(volume.CreatedAt), props: { modifier: "nowrap" } },
            { title: volume.Driver, props: { modifier: "nowrap" } },
            {
                title: <VolumeActions volume={volume} onAddNotification={this.props.onAddNotification} selinuxAvailable={this.props.selinuxAvailable}
                                     registries={this.props.registries} user={this.props.user}
                                     userServiceAvailable={this.props.userServiceAvailable}
                                     systemServiceAvailable={this.props.systemServiceAvailable}
                                     podmanRestartAvailable={this.props.podmanRestartAvailable} />,
                props: { className: 'pf-c-table__action content-action' }
            },
        ];

        tabs.push({
            name: _("Details"),
            renderer: VolumeDetails,
            data: {
                volume: volume,
                containers: this.props.volumeContainerList !== null ? this.props.volumeContainerList[volume.Name + volume.isSystem.toString()] : null,
                showAll: this.props.showAll,
            }
        });
        return {
            expandedContent: <ListingPanel
                                colSpan='8'
                                tabRenderers={tabs} />,
            columns: columns,
            props: {
                key :volume.Name + volume.isSystem.toString(),
                "data-row-id": volume.Name + volume.isSystem.toString(),
            },
        };
    }

    render() {
        const columnTitles = [
            _("Name"),
            _("Mountpoint"),
            _("Owner"),
            _("Created"),
            _("Driver"),
        ];
        let emptyCaption = _("No volumes");
        if (this.props.volumes === null)
            emptyCaption = "Loading...";
        else if (this.props.textFilter.length > 0)
            emptyCaption = _("No volumes that match the current filter");

        let filtered = [];
        if (this.props.volumes !== null) {
            filtered = Object.keys(this.props.volumes).filter(id => {
                if (this.props.userServiceAvailable && this.props.systemServiceAvailable && this.props.ownerFilter !== "all") {
                    if (this.props.ownerFilter === "system" && !this.props.volumes[id].isSystem)
                        return false;
                    if (this.props.ownerFilter !== "system" && this.props.volumes[id].isSystem)
                        return false;
                }
                return true;
            });
        }

        if (this.props.textFilter.length > 0) {
            const lcf = this.props.textFilter.toLowerCase();
            filtered = filtered.filter(id => this.props.volumes[id].Name.toLowerCase().indexOf(lcf) >= 0);
        }

        filtered.sort((a, b) => {
            // User volumes are in front of system ones
            if (this.props.volumes[a].isSystem !== this.props.volumes[b].isSystem)
                return this.props.volumes[a].isSystem ? 1 : -1;
            const name_a = this.props.volumes[a].name;
            const name_b = this.props.volumes[b].name;
            if (name_a === "")
                return 1;
            if (name_b === "")
                return -1;
            return name_a > name_b ? 1 : -1;
        });

        const volumeRows = filtered.map(id => this.renderRow(this.props.volumes[id]));

        const cardBody = (
            <>
                <ListingTable aria-label={_("Volumes")}
                              variant='compact'
                              emptyCaption={emptyCaption}
                              columns={columnTitles}
                              rows={volumeRows} />
            </>
        );

        const { volumeStats, unusedVolumes } = this.calculateStats();
        const volumeTitleStats = (
            <>
                <Text component={TextVariants.h5}>
                    {cockpit.format(cockpit.ngettext("$0 volume total", "$0 volumes total", volumeStats.volumesTotal), volumeStats.volumesTotal)}
                </Text>
            </>
        );

        return (
            <Card id="containers-volumes" key="volumes" className="containers-volumes">
                <CardHeader>
                    <Flex flexWrap={{ default: 'nowrap' }} className="pf-u-w-100">
                        <FlexItem grow={{ default: 'grow' }}>
                            <Flex>
                                <Text className="volumes-title" component={TextVariants.h3}>{_("Volumes")}</Text>
                                <Flex style={{ rowGap: "var(--pf-global--spacer--xs)" }}>{volumeTitleStats}</Flex>
                            </Flex>
                        </FlexItem>
                        <ToolbarItem>
                            <Button variant="primary" key="get-new-image-action"
                            id="volumes-volumes-create-volume-btn"
                            onClick={() => this.setState({ showVolumeCreateModal: true })}>
                                {_("Create volume")}
                            </Button>
                        </ToolbarItem>
                        {this.state.showVolumeCreateModal &&
                        <VolumeCreateModal
                        user={this.props.user}
                        close={() => this.setState({ showVolumeCreateModal: false })}
                        selinuxAvailable={this.props.selinuxAvailable}
                        podmanRestartAvailable={this.props.podmanRestartAvailable}
                        systemServiceAvailable={this.props.systemServiceAvailable}
                        userServiceAvailable={this.props.userServiceAvailable}
                        onAddNotification={this.props.onAddNotification}
                        /> }
                        <FlexItem>
                            <VolumeOverActions handlePruneUsedVolumes={this.onOpenPruneUnusedVolumesDialog}
                                              unusedVolumes={unusedVolumes} />
                        </FlexItem>
                    </Flex>
                </CardHeader>
                <CardBody>
                    {filtered.length
                        ? <ExpandableSection toggleText={this.state.isExpanded ? _("Hide volumes") : _("Show volumes")}
                                             onToggle={() => this.setState({ isExpanded: !this.state.isExpanded })}
                                             isExpanded={this.state.isExpanded}>
                            {cardBody}
                        </ExpandableSection>
                        : cardBody}
                </CardBody>
                {this.state.showPruneUnusedVolumesModal &&
                <PruneUnusedVolumesModal
                  close={() => this.setState({ showPruneUnusedVolumesModal: false })}
                  unusedVolumes={unusedVolumes}
                  onAddNotification={this.props.onAddNotification}
                  userServiceAvailable={this.props.userServiceAvailable}
                  systemServiceAvailable={this.props.systemServiceAvailable} /> }
            </Card>
        );
    }
}

const VolumeOverActions = ({ handlePruneUsedVolumes, unusedVolumes }) => {
    const [isActionsKebabOpen, setIsActionsKebabOpen] = useState(false);

    return (
        <Dropdown toggle={<KebabToggle onToggle={() => setIsActionsKebabOpen(!isActionsKebabOpen)} id="volume-actions-dropdown" />}
                  isOpen={isActionsKebabOpen}
                  isPlain
                  position="right"
                  dropdownItems={[
                      <DropdownItem key="prune-unused-volumes"
                                    id="prune-unused-volumes-button"
                                    component="button"
                                    className="pf-m-danger btn-delete"
                                    onClick={handlePruneUsedVolumes}
                                    isDisabled={unusedVolumes.length === 0}
                                    isAriaDisabled={unusedVolumes.length === 0}>
                          {_("Prune unused volumes")}
                      </DropdownItem>,
                  ]} />
    );
};

const VolumeActions = ({ volume, onAddNotification }) => {
    const [showVolumeDeleteModal, setShowVolumeDeleteModal] = useState(false);
    const [showVolumeDeleteErrorModal, setShowVolumeDeleteErrorModal] = useState(false);
    const [volumeDeleteErrorMsg, setVolumeDeleteErrorMsg] = useState();
    const [isActionsKebabOpen, setIsActionsKebabOpen] = useState(false);

    const handleRemoveVolume = () => {
        setShowVolumeDeleteModal(false);
        client.delVolume(volume.isSystem, volume.Name, false)
                .catch(ex => {
                    setVolumeDeleteErrorMsg(ex.message);
                    setShowVolumeDeleteErrorModal(true);
                });
    };

    const handleForceRemoveVolume = () => {
        return client.delVolume(volume.isSystem, volume.Name, true)
                .then(reply => setShowVolumeDeleteErrorModal(false))
                .catch(ex => {
                    const error = cockpit.format(_("Failed to force remove volume $0"), volume.Name);
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                    throw ex;
                });
    };

    const extraActions = (
        <Dropdown toggle={<KebabToggle onToggle={() => setIsActionsKebabOpen(!isActionsKebabOpen)} />}
                  isOpen={isActionsKebabOpen}
                  isPlain
                  position="right"
                  dropdownItems={[
                      <DropdownItem key={volume.Name + volume.isSystem.toString() + "delete"}
                                    component="button"
                                    className="pf-m-danger btn-delete"
                                    onClick={() => setShowVolumeDeleteModal(true)}>
                          {_("Delete")}
                      </DropdownItem>
                  ]} />
    );

    return (
        <>
            {extraActions}
            {showVolumeDeleteErrorModal &&
                <ForceRemoveModal
                        name={volume.Name}
                        handleCancel={() => setShowVolumeDeleteErrorModal(false)}
                        handleForceRemove={handleForceRemoveVolume}
                        reason={volumeDeleteErrorMsg} /> }
            {showVolumeDeleteModal &&
            <VolumeDeleteModal
                volumeWillDelete={volume}
                handleCancelVolumeDeleteModal={() => setShowVolumeDeleteModal(false)}
                handleRemoveVolume={handleRemoveVolume} /> }
        </>
    );
};

export default Volumes;
