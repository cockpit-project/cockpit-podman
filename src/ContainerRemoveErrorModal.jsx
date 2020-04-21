import React, { useState } from 'react';
import { Modal } from 'patternfly-react';
import { Button } from '@patternfly/react-core';
import cockpit from 'cockpit';

const _ = cockpit.gettext;

const ContainerRemoveErrorModal = (props) => {
    const name = props.containerWillDelete ? _(props.containerWillDelete.Name) : "";
    const [inProgress, setInProgress] = useState(false);
    return (
        <Modal key={name} show={props.setContainerRemoveErrorModal}>
            <Modal.Header>
                <Modal.Title>{cockpit.format(_("Please confirm forced deletion of $0"), name)}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {_("Container is currently running.")}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="danger" isDisabled={inProgress} className="btn-ctr-forcedelete" onClick={() => {
                    setInProgress(true); props.handleForceRemoveContainer().finally(() => setInProgress(false));
                }}>{_("Force Delete")}</Button>
                <Button variant="link" onClick={props.handleCancelRemoveError}>{_("Cancel")}</Button>
                {inProgress && <div className="spinner spinner-sm pull-right" />}
            </Modal.Footer>
        </Modal>
    );
};

export default ContainerRemoveErrorModal;
