import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Modal } from "@patternfly/react-core/dist/esm/components/Modal";
import { SortByDirection } from "@patternfly/react-table";

import cockpit from 'cockpit';
import { ListingTable } from 'cockpit-components-table';

import * as client from './client.js';
import { RelativeTime } from './util.js';

const _ = cockpit.gettext;

const getContainerRow = (container, userSystemServiceAvailable, user, selected) => {
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

    if (userSystemServiceAvailable)
        columns.push({
            title: container.system ? _("system") : <div><span className="ct-grey-text">{_("user:")} </span>{user}</div>,
            sortKey: container.system.toString(),
            props: {
                className: "ignore-pixels",
                modifier: "nowrap"
            }
        });

    return { columns, selected, props: { key: container.id } };
};

const PruneUnusedContainersModal = ({ close, unusedContainers, onAddNotification, userSystemServiceAvailable, user }) => {
    const [isPruning, setPruning] = useState(false);
    const [selectedContainerIds, setSelectedContainerIds] = React.useState(unusedContainers.map(u => u.id));

    const handlePruneUnusedContainers = () => {
        setPruning(true);

        const actions = [];

        for (const id of selectedContainerIds) {
            if (id.endsWith("true")) {
                actions.push(client.delContainer(true, id.replace(/true$/, ""), true));
            } else {
                actions.push(client.delContainer(false, id.replace(/false$/, ""), true));
            }
        }
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

    if (userSystemServiceAvailable)
        columns.push({ title: _("Owner"), sortable: true });

    const selectAllContainers = isSelecting => setSelectedContainerIds(isSelecting ? unusedContainers.map(c => c.id) : []);
    const isContainerSelected = container => selectedContainerIds.includes(container.id);
    const setContainerSelected = (container, isSelecting) => setSelectedContainerIds(prevSelected => {
        const otherSelectedContainerNames = prevSelected.filter(r => r !== container.id);
        return isSelecting ? [...otherSelectedContainerNames, container.id] : otherSelectedContainerNames;
    });

    const onSelectContainer = (id, _rowIndex, isSelecting) => {
        const container = unusedContainers.filter(u => u.id === id)[0];
        setContainerSelected(container, isSelecting);
    };

    return (
        <Modal isOpen
               onClose={close}
               position="top" variant="medium"
               title={cockpit.format(_("Prune unused containers"))}
               footer={<>
                   <Button id="btn-img-delete" variant="danger"
                           spinnerAriaValueText={isPruning ? _("Pruning containers") : undefined}
                           isLoading={isPruning}
                           isDisabled={isPruning || selectedContainerIds.length === 0}
                           onClick={handlePruneUnusedContainers}>
                       {isPruning ? _("Pruning containers") : _("Prune")}
                   </Button>
                   <Button variant="link" onClick={() => close()}>{_("Cancel")}</Button>
               </>}
        >
            <p>{_("Removes selected non-running containers")}</p>
            <ListingTable columns={columns}
                          onSelect={(_event, isSelecting, rowIndex, rowData) => onSelectContainer(rowData.props.id, rowIndex, isSelecting)}
                          onHeaderSelect={(_event, isSelecting) => selectAllContainers(isSelecting)}
                          id="unused-container-list"
                          rows={unusedContainers.map(container => getContainerRow(container, userSystemServiceAvailable, user, isContainerSelected(container))) }
                          variant="compact" sortBy={{ index: 0, direction: SortByDirection.asc }} />
        </Modal>
    );
};

export default PruneUnusedContainersModal;
