import React from 'react';
import { Button, Modal } from 'patternfly-react';
import cockpit from 'cockpit';

const _ = cockpit.gettext;

const ImageDeleteModal = (props) => {
    const repoTag = props.imageWillDelete.repoTags ? _(props.imageWillDelete.repoTags[0]) : _("");
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
                    <Button onClick={props.handleCancelImageDeleteModal}>Cancel</Button>
                    <Button id="btn-img-delete" bsStyle="danger" onClick={props.handleRemoveImage}>{_("Delete")}</Button>{' '}
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default ImageDeleteModal;
