import React from 'react';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap';
import cockpit from 'cockpit';
import * as utils from './util.js';

const _ = cockpit.gettext;

const ContainerDeleteModal = (props) => {
    return (
        <div>
            <Modal isOpen={props.selectContainerDeleteModal} fade={false} >
                <ModalHeader>
                    {cockpit.format(_("Please confirm deletion of $0"), utils.truncate_id(props.containerWillDelete.ID))}
                </ModalHeader>
                <ModalBody>
                    {_("Deleting a container will erase all data in it.")}
                </ModalBody>
                <ModalFooter>
                    <Button color="secondary" onClick={props.handleCancelContainerDeleteModal}>Cancel</Button>
                    <Button color="danger" onClick={props.handleRemoveContainer}>{_("Delete")}</Button>{' '}
                </ModalFooter>
            </Modal>
        </div>
    );
};

export default ContainerDeleteModal;
