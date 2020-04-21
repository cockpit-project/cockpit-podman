import React from 'react';
import { Modal } from 'patternfly-react';
import { Button } from '@patternfly/react-core';
import cockpit from 'cockpit';
import * as utils from './util.js';

const _ = cockpit.gettext;

const ContainerDeleteModal = (props) => {
    return (
        <Modal show={props.selectContainerDeleteModal}>
            <Modal.Header>
                <Modal.Title>{cockpit.format(_("Please confirm deletion of $0"), utils.truncate_id(props.containerWillDelete.id))}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {_("Deleting a container will erase all data in it.")}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="danger" className="btn-ctr-delete" onClick={props.handleRemoveContainer}>{_("Delete")}</Button>{' '}
                <Button variant="link" onClick={props.handleCancelContainerDeleteModal}>{_("Cancel")}</Button>
            </Modal.Footer>
        </Modal>
    );
};

export default ContainerDeleteModal;
