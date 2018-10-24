import React from 'react';
import { Button, Modal } from 'patternfly-react';
import cockpit from 'cockpit';

const _ = cockpit.gettext;

const ContainerCommitErrorModal = (props) => {
    const commitErr = _(props.commitErr);
    return (
        <div>
            <Modal show={props.setContainerCommitErrorModal} fade="false" >
                <Modal.Header>
                    <Modal.Title>{_("Unexpected error")}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {commitErr}
                </Modal.Body>
                <Modal.Footer>
                    <Button className="btn-ctr-close-commiterror" onClick={props.handleCloseCommitError}>{_("Close")}</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default ContainerCommitErrorModal;
