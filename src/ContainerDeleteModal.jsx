import React from 'react';
import { Button, Modal } from '@patternfly/react-core';
import { useDialogs } from "dialogs.jsx";
import cockpit from 'cockpit';

import * as client from './client.js';

const _ = cockpit.gettext;

const ContainerDeleteModal = ({ containerWillDelete, onAddNotification }) => {
    const Dialogs = useDialogs();

    const handleRemoveContainer = () => {
        const container = containerWillDelete;
        const id = container ? container.Id : "";

        Dialogs.close();
        client.delContainer(container.isSystem, id, false)
                .catch(ex => {
                    const error = cockpit.format(_("Failed to remove container $0"), container.Names);
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                });
    };

    return (
        <Modal isOpen
               position="top" variant="medium"
               titleIconVariant="warning"
               onClose={Dialogs.close}
               title={cockpit.format(_("Delete $0?"), containerWillDelete.Names)}
               footer={<>
                   <Button variant="danger" className="btn-ctr-delete" onClick={handleRemoveContainer}>{_("Delete")}</Button>{' '}
                   <Button variant="link" onClick={Dialogs.close}>{_("Cancel")}</Button>
               </>}
        >
            {_("Deleting a container will erase all data in it.")}
        </Modal>
    );
};

export default ContainerDeleteModal;
