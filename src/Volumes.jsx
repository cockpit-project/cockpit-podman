/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React from 'react';

import { Card, CardBody, CardHeader, CardTitle } from "@patternfly/react-core/dist/esm/components/Card";
import { DropdownItem } from '@patternfly/react-core/dist/esm/components/Dropdown/index.js';
import { ExpandableSection } from "@patternfly/react-core/dist/esm/components/ExpandableSection";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex";
import { cellWidth, SortByDirection } from '@patternfly/react-table';
import { KebabDropdown } from "cockpit-components-dropdown.jsx";
import { ListingTable } from "cockpit-components-table.jsx";
import { useDialogs } from 'dialogs.js';

import cockpit from 'cockpit';

import { VolumeDeleteModal } from './VolumeDeleteModal.jsx';
import * as utils from './util.js';

const _ = cockpit.gettext;

const Volumes = ({ users, volumes, ownerFilter, textFilter, volumeContainerMap }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);

    const getUsedByText = (volume) => {
        if (volumeContainerMap === null) {
            return { title: _("unused"), count: 0 };
        }
        const containers = volumeContainerMap[volume.key];
        if (containers !== undefined) {
            const title = cockpit.format(cockpit.ngettext("$0 container", "$0 containers", containers.length), containers.length);
            return { title, count: containers.length };
        } else {
            return { title: _("unused"), count: 0 };
        }
    };

    const renderRow = volume => {
        const { title: usedByText, count: usedByCount } = getUsedByText(volume);
        const user = users.find(user => user.uid === volume.uid);
        cockpit.assert(user, `User not found for volume uid ${volume.uid}`);

        const columns = [
            { title: volume.Name, header: true, props: { modifier: "breakWord" } },
            {
                title: (volume.uid === 0) ? _("system") : <div><span className="ct-grey-text">{_("user:")} </span>{user.name}</div>,
                props: { modifier: "nowrap" },
                sortKey: volume.key,
            },
            { title: volume.Mountpoint, header: true, props: { modifier: "breakWord" } },
            { title: volume.Driver, header: true, props: { modifier: "breakWord" } },
            { title: <utils.RelativeTime time={volume.CreatedAt} />, props: { className: "ignore-pixels" } },
            { title: <span className={usedByCount === 0 ? "ct-grey-text" : ""}>{usedByText}</span>, props: { className: "ignore-pixels", modifier: "nowrap" }, sortKey: usedByCount },
            {
                title: <VolumeActions con={user.con} volume={volume} />,
                props: { className: 'pf-v6-c-table__action content-action' }
            },
        ];

        return {
            columns,
            props: {
                key: volume.key,
                "data-row-id": volume.key,
                "data-row-name": `${volume.uid === null ? 'user' : volume.uid}-${volume.Name}`
            },
        };
    };

    const sortRows = (rows, direction, idx) => {
        // Name / Owner / Mount Point / Driver / Created / Used by
        const isNumeric = idx == 4 || idx == 5;
        const sortedRows = rows.sort((a, b) => {
            const aitem = a.columns[idx].sortKey ?? a.columns[idx].title;
            const bitem = b.columns[idx].sortKey ?? b.columns[idx].title;
            if (isNumeric) {
                return bitem - aitem;
            } else {
                return aitem.localeCompare(bitem);
            }
        });
        return direction === SortByDirection.asc ? sortedRows : sortedRows.reverse();
    };

    const columnTitles = [
        { title: _("Name"), transforms: [cellWidth(20)], sortable: true },
        { title: _("Owner"), sortable: true },
        { title: _("Mount point"), sortable: true },
        { title: _("Driver"), sortable: true },
        { title: _("Created"), sortable: true },
        { title: _("Used by"), sortable: true },
    ];

    let emptyCaption = _("No volumes");
    if (volumes === null) {
        emptyCaption = _("Loading...");
    } else if (textFilter.length > 0) {
        emptyCaption = _("No volumes that match the current filter");
    }

    const volumeKeys = Object.keys(volumes || {});
    const volumesTotal = volumeKeys.length;

    let filtered = [];
    if (volumes !== null) {
        filtered = volumeKeys.filter(id => {
            if (ownerFilter !== "all") {
                if (ownerFilter === "user")
                    return volumes[id].uid === null;
                return volumes[id].uid === ownerFilter;
            }

            const name = volumes[id].Name;
            if (textFilter.length > 0)
                return name.toLowerCase().includes(textFilter);
            return true;
        });
    }

    const rows = filtered.map(name => renderRow(volumes[name]));

    const cardBody = (
        <ListingTable variant='compact'
                      aria-label={_("Volumes")}
                      emptyCaption={emptyCaption}
                      columns={columnTitles}
                      rows={rows}
                      sortMethod={sortRows}
        />
    );

    const volumesTitleStats = (
        <h5>
            {cockpit.format(cockpit.ngettext("$0 volume total", "$0 volumes total", volumesTotal), volumesTotal)}
        </h5>
    );

    return (
        <Card id="containers-volumes" className="containers-volumes">
            <CardHeader>
                <Flex flexWrap={{ default: 'nowrap' }} className="pf-v6-u-w-100">
                    <FlexItem grow={{ default: 'grow' }}>
                        <Flex>
                            <CardTitle>
                                <h2 className="containers-images-title">{_("Volumes")}</h2>
                            </CardTitle>
                            <Flex className="ignore-pixels" style={{ rowGap: "var(--pf-v6-global--spacer--xs)" }}>{volumesTitleStats}</Flex>
                        </Flex>
                    </FlexItem>
                </Flex>
            </CardHeader>
            <CardBody>
                {volumes && Object.keys(volumes).length
                    ? <ExpandableSection toggleText={isExpanded ? _("Hide volumes") : _("Show volumes")}
                                             onToggle={() => setIsExpanded(!isExpanded)}
                                             isExpanded={isExpanded}>
                        {cardBody}
                    </ExpandableSection>
                    : cardBody}
            </CardBody>
        </Card>
    );
};

const VolumeActions = ({ con, volume }) => {
    const Dialogs = useDialogs();

    const removeImage = () => {
        Dialogs.show(<VolumeDeleteModal
                        con={con}
                        volume={volume}

        />);
    };

    const dropdownActions = [
        <DropdownItem key={volume.Name + "delete"}
                    component="button"
                    className="pf-m-danger btn-delete"
                    onClick={removeImage}>
            {_("Delete")}
        </DropdownItem>
    ];

    return <KebabDropdown position="right" dropdownItems={dropdownActions} />;
};

export default Volumes;
