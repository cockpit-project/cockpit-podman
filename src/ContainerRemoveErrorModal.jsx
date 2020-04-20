import React from 'react';
import { Modal } from 'patternfly-react';
import { Button } from '@patternfly/react-core';
import cockpit from 'cockpit';

const _ = cockpit.gettext;

const ContainerRemoveErrorModal = (props) => {
    const name = props.containerWillDelete ? _(props.containerWillDelete.Name) : "";
    return (
        <div>
            <Modal show={props.setContainerRemoveErrorModal}>
                <Modal.Header>
                    <Modal.Title>{cockpit.format(_("Please confirm forced deletion of $0"), name)}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {_("Container is currently running.")}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="danger" className="btn-ctr-forcedelete" onClick={props.handleForceRemoveContainer}>{_("Force Delete")}</Button>
                    <Button variant="link" onClick={props.handleCancelRemoveError}>{_("Cancel")}</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default ContainerRemoveErrorModal;
