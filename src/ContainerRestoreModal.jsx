import React, { useState } from 'react';
import { Button, Checkbox, Form, Modal } from '@patternfly/react-core';
import { useDialogs } from "dialogs.jsx";
import cockpit from 'cockpit';

import * as client from './client.js';

const _ = cockpit.gettext;

const ContainerRestoreModal = ({ containerWillRestore, onAddNotification }) => {
    const Dialogs = useDialogs();

    const [inProgress, setInProgress] = useState(false);
    const [keep, setKeep] = useState(false);
    const [tcpEstablished, setTcpEstablished] = useState(false);
    const [ignoreStaticIP, setIgnoreStaticIP] = useState(false);
    const [ignoreStaticMAC, setIgnoreStaticMAC] = useState(false);

    const handleRestoreContainer = () => {
        setInProgress(true);
        client.postContainer(containerWillRestore.isSystem, "restore", containerWillRestore.Id, {
            keep,
            tcpEstablished,
            ignoreStaticIP,
            ignoreStaticMAC,
        })
                .catch(ex => {
                    const error = cockpit.format(_("Failed to restore container $0"), containerWillRestore.Names);
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                    setInProgress(false);
                })
                .finally(() => {
                    Dialogs.close();
                });
    };

    return (
        <Modal isOpen
               showClose={false}
               position="top" variant="medium"
               title={cockpit.format(_("Restore container $0"), containerWillRestore.Names)}
               footer={<>
                   <Button variant="primary" isDisabled={inProgress}
                           isLoading={inProgress}
                           onClick={handleRestoreContainer}>
                       {_("Restore")}
                   </Button>
                   <Button variant="link" isDisabled={inProgress}
                           onClick={Dialogs.close}>
                       {_("Cancel")}
                   </Button>
               </>}
        >
            <Form isHorizontal>
                <Checkbox label={_("Keep all temporary checkpoint files")} id="restore-dialog-keep" name="keep"
                          isChecked={keep} onChange={setKeep} />
                <Checkbox label={_("Restore with established TCP connections")}
                          id="restore-dialog-tcpEstablished" name="tcpEstablished"
                          isChecked={tcpEstablished} onChange={setTcpEstablished} />
                <Checkbox label={_("Ignore IP address if set statically")} id="restore-dialog-ignoreStaticIP"
                          name="ignoreStaticIP" isChecked={ignoreStaticIP}
                          onChange={setIgnoreStaticIP} />
                <Checkbox label={_("Ignore MAC address if set statically")} id="restore-dialog-ignoreStaticMAC"
                          name="ignoreStaticMAC" isChecked={ignoreStaticMAC}
                          onChange={setIgnoreStaticMAC} />
            </Form>
        </Modal>
    );
};

export default ContainerRestoreModal;
