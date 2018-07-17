import React from 'react';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap';
import cockpit from 'cockpit';

const _ = cockpit.gettext;

const ImageRemoveErrorModal = (props) => {
    const repoTag = props.imageWillDelete.RepoTags ? _(props.imageWillDelete.RepoTags[0]) : _("");
    return (
        <div>
            <Modal isOpen={props.setImageRemoveErrorModal} fade={false} >
                <ModalHeader>
                    {cockpit.format(_("Please confirm forced deletion of $0"),  _(repoTag))}
                </ModalHeader>
                <ModalBody>
                    {_(props.imageRemoveErrorMsg)}
                </ModalBody>
                <ModalFooter>
                    <Button color="secondary" onClick={props.handleCancelImageRemoveError}>{_("Cancel")}</Button>
                    <Button color="danger" onClick={props.handleForceRemoveImage}>{_("Force Delete")}</Button>{' '}
                </ModalFooter>
            </Modal>
        </div>
    );
}

export default ImageRemoveErrorModal;