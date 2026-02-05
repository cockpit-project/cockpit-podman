/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { SortByDirection } from "@patternfly/react-table";

import cockpit from 'cockpit';
import { ListingTable } from 'cockpit-components-table';

import * as client from './client.js';
import { RelativeTime } from './util.js';

const _ = cockpit.gettext;

const getContainerRow = (container, showOwnerColumn, users, selected) => {
    const columns = [
        {
            title: container.name,
            sortKey: container.name,
            props: { width: 25, },
        },
        {
            title: <RelativeTime time={container.created} />,
            props: { width: 20, },
        },
    ];

    const username = users.find(u => u.uid === container.uid)?.name;

    if (showOwnerColumn)
        columns.push({
            title: container.uid === 0 ? _("system") : <div><span className="ct-grey-text">{_("user:")} </span>{username}</div>,
            sortKey: container.key,
            props: {
                className: "ignore-pixels",
                modifier: "nowrap"
            }
        });

    return { columns, selected, props: { key: container.key } };
};

const PruneUnusedContainersModal = ({ close, unusedContainers, onAddNotification, users }) => {
    const [isPruning, setPruning] = useState(false);
    const [selectedContainerKeys, setSelectedContainerKeys] = React.useState(unusedContainers.map(u => u.key));

    const handlePruneUnusedContainers = () => {
        setPruning(true);

        const con_for = uid => users.find(u => u.uid === uid).con;

        const actions = unusedContainers
                .filter(u => selectedContainerKeys.includes(u.key))
                .map(u => client.delContainer(con_for(u.uid), u.id, true));

        Promise.all(actions).then(close)
                .catch(ex => {
                    const error = _("Failed to prune unused containers");
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                    close();
                });
    };

    const columns = [
        { title: _("Name"), sortable: true },
        { title: _("Created"), sortable: true },
    ];

    const showOwnerColumn = unusedContainers.some(u => u.uid !== 0);

    if (showOwnerColumn)
        columns.push({ title: _("Owner"), sortable: true });

    const selectAllContainers = isSelecting => setSelectedContainerKeys(isSelecting ? unusedContainers.map(c => c.key) : []);
    const isContainerSelected = container => selectedContainerKeys.includes(container.key);
    const setContainerSelected = (container, isSelecting) => setSelectedContainerKeys(prevSelected => {
        const otherSelectedContainerNames = prevSelected.filter(r => r !== container.key);
        return isSelecting ? [...otherSelectedContainerNames, container.key] : otherSelectedContainerNames;
    });

    const onSelectContainer = (key, _rowIndex, isSelecting) => {
        const container = unusedContainers.find(u => u.key === key);
        setContainerSelected(container, isSelecting);
    };

    return (
        <Modal isOpen
               onClose={close}
               position="top" variant="medium"
        >
            <ModalHeader title={cockpit.format(_("Prune unused containers"))} />
            <ModalBody>
                <p>{_("Removes selected non-running containers")}</p>
                <ListingTable columns={columns}
                              onSelect={(_event, isSelecting, rowIndex, rowData) => onSelectContainer(rowData.props.id, rowIndex, isSelecting)}
                              onHeaderSelect={(_event, isSelecting) => selectAllContainers(isSelecting)}
                              id="unused-container-list"
                              rows={unusedContainers.map(container => getContainerRow(container, showOwnerColumn, users, isContainerSelected(container))) }
                              variant="compact" sortBy={{ index: 0, direction: SortByDirection.asc }} />
            </ModalBody>
            <ModalFooter>
                <Button id="btn-img-delete" variant="danger"
                        spinnerAriaValueText={isPruning ? _("Pruning containers") : undefined}
                        isLoading={isPruning}
                        isDisabled={isPruning || selectedContainerKeys.length === 0}
                        onClick={handlePruneUnusedContainers}>
                    {isPruning ? _("Pruning containers") : _("Prune")}
                </Button>
                <Button variant="link" onClick={() => close()}>{_("Cancel")}</Button>
            </ModalFooter>
        </Modal>
    );
};

export default PruneUnusedContainersModal;
