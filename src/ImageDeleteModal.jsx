import React from 'react';
import { Modal } from 'patternfly-react';
import { Button } from '@patternfly/react-core';
import cockpit from 'cockpit';

const _ = cockpit.gettext;

const ImageDeleteModal = (props) => {
    const repoTag = props.imageWillDelete.repoTags ? _(props.imageWillDelete.repoTags[0]) : "";
    return (
        <div>
            <Modal show={props.selectImageDeleteModal}>
                <Modal.Header>
                    <Modal.Title>{cockpit.format(_("Delete $0"), repoTag)}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {_("Are you sure you want to delete this image?")}
                </Modal.Body>
                <Modal.Footer>
                    <Button onClick={props.handleCancelImageDeleteModal}>{_("Cancel")}</Button>
                    <Button id="btn-img-delete" variant="danger" onClick={props.handleRemoveImage}>{_("Delete")}</Button>{' '}
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default ImageDeleteModal;
