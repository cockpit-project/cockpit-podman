import React from 'react';
import {Button, Modal} from 'patternfly-react';
import cockpit from 'cockpit';
import * as utils from './util.js';

const _ = cockpit.gettext;

const ContainerDeleteModal = (props) => {
    return (
        <div>
            <Modal show={props.selectContainerDeleteModal}>
                <Modal.Header>
                    <Modal.Title>{cockpit.format(_("Please confirm deletion of $0"), utils.truncate_id(props.containerWillDelete.ID))}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {_("Deleting a container will erase all data in it.")}
                </Modal.Body>
                <Modal.Footer>
                    <Button onClick={props.handleCancelContainerDeleteModal}>Cancel</Button>
                    <Button bsStyle="danger" className="btn-ctr-delete" onClick={props.handleRemoveContainer}>{_("Delete")}</Button>{' '}
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default ContainerDeleteModal;
