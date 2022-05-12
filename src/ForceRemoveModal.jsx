import React, { useState } from 'react';
import { Button, Modal } from '@patternfly/react-core';
import cockpit from 'cockpit';

const _ = cockpit.gettext;

const ForceRemoveModal = (props) => {
    const [inProgress, setInProgress] = useState(false);
    return (
        <Modal isOpen
               showClose={false}
               position="top" variant="medium"
               titleIconVariant="warning"
               onClose={props.handleCancel}
               title={cockpit.format(_("Confirm forced deletion of $0"), props.name)}
               footer={<>
                   <Button variant="danger" isDisabled={inProgress} isLoading={inProgress}
                           onClick={() => { setInProgress(true); props.handleForceRemove().catch(() => setInProgress(false)) }}
                   >
                       {_("Force delete")}
                   </Button>
                   <Button variant="link" isDisabled={inProgress} onClick={props.handleCancel}>{_("Cancel")}</Button>
               </>}
        >
            {_(props.reason)}
        </Modal>
    );
};

export default ForceRemoveModal;
