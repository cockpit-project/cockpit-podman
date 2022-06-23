import React from 'react';
import { Button, Modal } from '@patternfly/react-core';
import { useDialogs } from "dialogs.jsx";
import cockpit from 'cockpit';

const _ = cockpit.gettext;

const ContainerDeleteModal = ({ containerWillDelete, handleRemoveContainer }) => {
    const Dialogs = useDialogs();
    return (
        <Modal isOpen
               position="top" variant="medium"
               titleIconVariant="warning"
               onClose={Dialogs.close}
               title={cockpit.format(_("Confirm deletion of $0"), containerWillDelete.Names)}
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
