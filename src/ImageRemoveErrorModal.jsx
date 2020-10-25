import React from 'react';
import { Button, Modal } from '@patternfly/react-core';
import cockpit from 'cockpit';

const _ = cockpit.gettext;

const ImageRemoveErrorModal = (props) => {
    const repoTag = props.imageWillDelete.RepoTags ? _(props.imageWillDelete.RepoTags[0]) : "";
    return (
        <Modal isOpen={props.setImageRemoveErrorModal}
               position="top" variant="medium"
               onClose={props.handleCancelImageRemoveError}
               title={cockpit.format(_("Please confirm forced deletion of $0"), _(repoTag))}
               footer={<>
                   <Button id="btn-img-deleteerror" variant="danger" onClick={props.handleForceRemoveImage}>{_("Force delete")}</Button>
                   <Button variant="link" onClick={props.handleCancelImageRemoveError}>{_("Cancel")}</Button>
               </>}
        >
            {_(props.imageRemoveErrorMsg)}
        </Modal>
    );
};

export default ImageRemoveErrorModal;
