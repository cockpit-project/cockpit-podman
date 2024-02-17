import React, { useState } from 'react';
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Modal } from "@patternfly/react-core/dist/esm/components/Modal";
import { useDialogs } from "dialogs.jsx";
import cockpit from 'cockpit';

const _ = cockpit.gettext;

const ForceRemoveModal = ({ name, reason, handleForceRemove }) => {
    const Dialogs = useDialogs();
    const [inProgress, setInProgress] = useState(false);
    return (
        <Modal isOpen
               showClose={false}
               position="top" variant="medium"
               titleIconVariant="warning"
               onClose={Dialogs.close}
               title={cockpit.format(_("Delete $0?"), name)}
               footer={<>
                   <Button variant="danger" isDisabled={inProgress} isLoading={inProgress}
                           onClick={() => { setInProgress(true); handleForceRemove().catch(() => setInProgress(false)) }}
                   >
                       {_("Force delete")}
                   </Button>
                   <Button variant="link" isDisabled={inProgress} onClick={Dialogs.close}>{_("Cancel")}</Button>
               </>}
        >
            {reason}
        </Modal>
    );
};

export default ForceRemoveModal;
