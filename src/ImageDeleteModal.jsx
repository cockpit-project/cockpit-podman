import React from 'react';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap';
import cockpit from 'cockpit';

const _ = cockpit.gettext;

const ImageDeleteModal = (props) => {
    const repoTag = props.imageWillDelete.RepoTags ? _(props.imageWillDelete.RepoTags[0]) : _("");
    return (
        <div>
            <Modal isOpen={props.selectImageDeleteModal} fade={false} >
                <ModalHeader>
                    {cockpit.format(_("Delete $0"), repoTag)}
                </ModalHeader>
                <ModalBody>
                    {_("Are you sure you want to delete this image?")}
                </ModalBody>
                <ModalFooter>
                    <Button color="secondary" onClick={props.handleCancelImageDeleteModal}>Cancel</Button>
                    <Button color="danger" onClick={props.handleRemoveImage}>{_("Delete")}</Button>{' '}
                </ModalFooter>
            </Modal>
        </div>
    );
}

export default ImageDeleteModal;