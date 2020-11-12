import React, { useState } from 'react';
import { Button, Modal } from '@patternfly/react-core';
import cockpit from 'cockpit';

const _ = cockpit.gettext;

const ContainerRemoveErrorModal = (props) => {
    const name = props.containerWillDelete ? _(props.containerWillDelete.Names) : "";
    const [inProgress, setInProgress] = useState(false);
    return (
        <Modal key={name} isOpen={props.setContainerRemoveErrorModal}
               showClose={false}
               position="top" variant="medium"
               title={cockpit.format(_("Please confirm forced deletion of $0"), name)}
               footer={<>
                   <Button variant="danger" isDisabled={inProgress} isLoading={inProgress} className="btn-ctr-forcedelete"
                           onClick={() => { setInProgress(true); props.handleForceRemoveContainer().finally(() => setInProgress(false)) }}
                   >
                       {_("Force delete")}
                   </Button>
                   <Button variant="link" isDisabled={inProgress} onClick={props.handleCancelRemoveError}>{_("Cancel")}</Button>
               </>}
        >
            {_("Container is currently running.")}
        </Modal>
    );
};

export default ContainerRemoveErrorModal;
