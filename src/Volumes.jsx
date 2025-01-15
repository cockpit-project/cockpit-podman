import React from 'react';

import { Card, CardBody, CardHeader, CardTitle } from "@patternfly/react-core/dist/esm/components/Card";
import { ExpandableSection } from "@patternfly/react-core/dist/esm/components/ExpandableSection";
import { Text, TextVariants } from "@patternfly/react-core/dist/esm/components/Text";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex";
import { cellWidth, SortByDirection } from '@patternfly/react-table';

import cockpit from 'cockpit';
import { ListingTable } from "cockpit-components-table.jsx";

import * as utils from './util.js';

const _ = cockpit.gettext;

const initContainerVolumeMap = containers => {
    const containerVolumes = {};
    if (containers === null)
        return containerVolumes;

    Object.keys(containers).forEach(id => {
        const container = containers[id];
        for (const mount of container.Mounts) {
            if (mount.Type === "volume") {
                const volume_key = mount.Name + container.isSystem.toString();
                if (volume_key in containerVolumes) {
                    containerVolumes[volume_key] += 1;
                } else {
                    containerVolumes[volume_key] = 1;
                }
            }
        }
    });

    return containerVolumes;
};

const Volumes = ({ user, volumes, containers }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const containerVolumes = initContainerVolumeMap(containers);

    const getUsedByText = volume => {
        const containers = containerVolumes[volume.Name + volume.isSystem.toString()];
        if (containers !== undefined) {
            const title = cockpit.format(cockpit.ngettext("$0 container", "$0 containers", containers), containers);
            return { title, count: containers.length };
        } else {
            return { title: _("unused"), count: 0 };
        }
    };

    const renderRow = volume => {
        const { title: usedByText, count: usedByCount } = getUsedByText(volume);

        const columns = [
            { title: volume.Name, header: true, props: { modifier: "breakWord" } },
            {
                title: volume.isSystem ? _("system") : <div><span className="ct-grey-text">{_("user:")} </span>{user}</div>,
                props: { className: "ignore-pixels", modifier: "nowrap" },
                sortKey: volume.isSystem.toString(),
            },
            { title: volume.Mountpoint, header: true, props: { modifier: "breakWord" } },
            { title: volume.Driver, header: true, props: { modifier: "breakWord" } },
            { title: <utils.RelativeTime time={volume.CreatedAt} />, props: { className: "ignore-pixels" } },
            {
                title: <span className={usedByCount === 0 ? "ct-grey-text" : ""}>{usedByText}</span>,
                props: { className: "ignore-pixels", modifier: "nowrap" },
            },
        ];

        return {
            columns,
            props: {
                key: volume.Name + volume.isSystem.toString(),
                "data-row-id": volume.Name + volume.isSystem.toString(),
            },
        };
    };

    const sortRows = (rows, direction, idx) => {
        const isNumeric = idx == 4;
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

    const rows = Object.keys(volumes || {}).map(name => renderRow(volumes[name]));
    const volumesTotal = Object.keys(volumes || {}).length;

    const cardBody = (
        <ListingTable variant='compact'
                      aria-label={_("Volumes")}
                      emptyCaption={_("No volumes")}
                      columns={columnTitles}
                      rows={rows}
                      sortMethod={sortRows}
        />
    );

    const volumesTitleStats = (
        <Text component={TextVariants.h5}>
            {cockpit.format(cockpit.ngettext("$0 volume total", "$0 volumes total", volumesTotal), volumesTotal)}
        </Text>
    );

    return (
        <Card id="containers-volumes" className="containers-volumes" isClickable isSelectable>
            <CardHeader>
                <Flex flexWrap={{ default: 'nowrap' }} className="pf-v5-u-w-100">
                    <FlexItem grow={{ default: 'grow' }}>
                        <Flex>
                            <CardTitle>
                                <Text component={TextVariants.h2} className="containers-images-title">{_("Volumes")}</Text>
                            </CardTitle>
                            <Flex className="ignore-pixels" style={{ rowGap: "var(--pf-v5-global--spacer--xs)" }}>{volumesTitleStats}</Flex>
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

export default Volumes;
