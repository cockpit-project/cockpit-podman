import React from 'react';
import { Modal } from 'patternfly-react';
import { Button } from '@patternfly/react-core';
import cockpit from 'cockpit';

const _ = cockpit.gettext;

const ImageRemoveErrorModal = (props) => {
    const repoTag = props.imageWillDelete.RepoTags ? _(props.imageWillDelete.RepoTags[0]) : "";
    return (
        <Modal show={props.setImageRemoveErrorModal}>
            <Modal.Header>
                <Modal.Title>{cockpit.format(_("Please confirm forced deletion of $0"), _(repoTag))}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {_(props.imageRemoveErrorMsg)}
            </Modal.Body>
            <Modal.Footer>
                <Button id="btn-img-deleteerror" variant="danger" onClick={props.handleForceRemoveImage}>{_("Force delete")}</Button>
                <Button variant="link" onClick={props.handleCancelImageRemoveError}>{_("Cancel")}</Button>
            </Modal.Footer>
        </Modal>
    );
};

export default ImageRemoveErrorModal;
