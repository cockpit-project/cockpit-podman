import React, { useState } from 'react';
import { Button, Modal } from '@patternfly/react-core';
import cockpit from 'cockpit';

const _ = cockpit.gettext;

const ImageRemoveErrorModal = (props) => {
    const [inProgress, setInProgress] = useState(false);
    const repoTag = props.imageWillDelete.RepoTags ? _(props.imageWillDelete.RepoTags[0]) : "";
    return (
        <Modal isOpen
               showClose={false}
               position="top" variant="medium"
               onClose={props.handleCancelImageRemoveError}
               title={cockpit.format(_("Please confirm forced deletion of $0"), _(repoTag))}
               footer={<>
                   <Button id="btn-img-deleteerror" variant="danger" isDisabled={inProgress} isLoading={inProgress}
                           onClick={() => { setInProgress(true); props.handleForceRemoveImage().finally(() => setInProgress(false)) }}
                   >
                       {_("Force delete")}
                   </Button>
                   <Button variant="link" isDisabled={inProgress} onClick={props.handleCancelImageRemoveError}>{_("Cancel")}</Button>
               </>}
        >
            {_(props.imageRemoveErrorMsg)}
        </Modal>
    );
};

export default ImageRemoveErrorModal;
