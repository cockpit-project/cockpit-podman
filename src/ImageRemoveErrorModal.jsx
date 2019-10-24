import React from 'react';
import { Button, Modal } from 'patternfly-react';
import cockpit from 'cockpit';

const _ = cockpit.gettext;

const ImageRemoveErrorModal = (props) => {
    const repoTag = props.imageWillDelete.RepoTags ? _(props.imageWillDelete.RepoTags[0]) : "";
    return (
        <div>
            <Modal show={props.setImageRemoveErrorModal}>
                <Modal.Header>
                    <Modal.Title>{cockpit.format(_("Please confirm forced deletion of $0"), _(repoTag))}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {_(props.imageRemoveErrorMsg)}
                </Modal.Body>
                <Modal.Footer>
                    <Button onClick={props.handleCancelImageRemoveError}>{_("Cancel")}</Button>
                    <Button id="btn-img-deleteerror" bsStyle="danger" onClick={props.handleForceRemoveImage}>{_("Force Delete")}</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default ImageRemoveErrorModal;
