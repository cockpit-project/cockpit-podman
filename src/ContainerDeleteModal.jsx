import React from 'react';
import { Button, Modal } from '@patternfly/react-core';
import cockpit from 'cockpit';

const _ = cockpit.gettext;

const ContainerDeleteModal = (props) => {
    return (
        <Modal isOpen={props.selectContainerDeleteModal}
               position="top" variant="medium"
               onClose={props.handleCancelContainerDeleteModal}
               title={cockpit.format(_("Please confirm deletion of $0"), props.containerWillDelete.Names)}
               footer={<>
                   <Button variant="danger" className="btn-ctr-delete" onClick={props.handleRemoveContainer}>{_("Delete")}</Button>{' '}
                   <Button variant="link" onClick={props.handleCancelContainerDeleteModal}>{_("Cancel")}</Button>
               </>}
        >
            {_("Deleting a container will erase all data in it.")}
        </Modal>
    );
};

export default ContainerDeleteModal;
