import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { Form } from "@patternfly/react-core/dist/esm/components/Form";
import { Modal } from "@patternfly/react-core/dist/esm/components/Modal";
import { useDialogs } from "dialogs.jsx";

import cockpit from 'cockpit';

import * as client from './client.js';

const _ = cockpit.gettext;

const ContainerCheckpointModal = ({ containerWillCheckpoint, onAddNotification }) => {
    const Dialogs = useDialogs();
    const [inProgress, setProgress] = useState(false);
    const [keep, setKeep] = useState(false);
    const [leaveRunning, setLeaveRunning] = useState(false);
    const [tcpEstablished, setTcpEstablished] = useState(false);

    const handleCheckpointContainer = () => {
        setProgress(true);
        client.postContainer(containerWillCheckpoint.isSystem, "checkpoint", containerWillCheckpoint.Id, {
            keep,
            leaveRunning,
            tcpEstablished,
        })
                .catch(ex => {
                    const error = cockpit.format(_("Failed to checkpoint container $0"), containerWillCheckpoint.Name); // not-covered: OS error
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                    setProgress(false);
                })
                .finally(() => {
                    Dialogs.close();
                });
    };

    return (
        <Modal isOpen
               showClose={false}
               position="top" variant="medium"
               title={cockpit.format(_("Checkpoint container $0"), containerWillCheckpoint.Name)}
               footer={<>
                   <Button variant="primary" isDisabled={inProgress}
                           isLoading={inProgress}
                           onClick={handleCheckpointContainer}>
                       {_("Checkpoint")}
                   </Button>
                   <Button variant="link" isDisabled={inProgress}
                           onClick={Dialogs.close}>
                       {_("Cancel")}
                   </Button>
               </>}
        >
            <Form isHorizontal>
                <Checkbox label={_("Keep all temporary checkpoint files")} id="checkpoint-dialog-keep"
                              name="keep" isChecked={keep} onChange={(_, val) => setKeep(val)} />
                <Checkbox label={_("Leave running after writing checkpoint to disk")}
                              id="checkpoint-dialog-leaveRunning" name="leaveRunning"
                              isChecked={leaveRunning} onChange={(_, val) => setLeaveRunning(val)} />
                <Checkbox label={_("Support preserving established TCP connections")}
                              id="checkpoint-dialog-tcpEstablished" name="tcpEstablished"
                              isChecked={tcpEstablished} onChange={(_, val) => setTcpEstablished(val) } />
            </Form>
        </Modal>
    );
};

export default ContainerCheckpointModal;
