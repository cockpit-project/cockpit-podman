/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { Form } from "@patternfly/react-core/dist/esm/components/Form";
import {
    Modal, ModalHeader, ModalBody, ModalFooter
} from '@patternfly/react-core/dist/esm/components/Modal';
import { useDialogs } from "dialogs.jsx";

import cockpit from 'cockpit';

import * as client from './client.js';

const _ = cockpit.gettext;

const ContainerRestoreModal = ({ con, containerWillRestore, onAddNotification }) => {
    const Dialogs = useDialogs();

    const [inProgress, setInProgress] = useState(false);
    const [keep, setKeep] = useState(false);
    const [tcpEstablished, setTcpEstablished] = useState(false);
    const [ignoreStaticIP, setIgnoreStaticIP] = useState(false);
    const [ignoreStaticMAC, setIgnoreStaticMAC] = useState(false);

    const handleRestoreContainer = () => {
        setInProgress(true);
        client.postContainer(con, "restore", containerWillRestore.Id, {
            keep,
            tcpEstablished,
            ignoreStaticIP,
            ignoreStaticMAC,
        })
                .catch(ex => {
                    const error = cockpit.format(_("Failed to restore container $0"), containerWillRestore.Name); // not-covered: OS error
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                    setInProgress(false);
                })
                .finally(() => {
                    Dialogs.close();
                });
    };

    return (
        <Modal isOpen
               position="top" variant="medium"
        >
            <ModalHeader title={cockpit.format(_("Restore container $0"), containerWillRestore.Name)} />
            <ModalBody>
                <Form isHorizontal>
                    <Checkbox label={_("Keep all temporary checkpoint files")} id="restore-dialog-keep" name="keep"
                              isChecked={keep} onChange={(_, val) => setKeep(val)} />
                    <Checkbox label={_("Restore with established TCP connections")}
                              id="restore-dialog-tcpEstablished" name="tcpEstablished"
                              isChecked={tcpEstablished} onChange={(_, val) => setTcpEstablished(val)} />
                    <Checkbox label={_("Ignore IP address if set statically")} id="restore-dialog-ignoreStaticIP"
                              name="ignoreStaticIP" isChecked={ignoreStaticIP}
                              onChange={(_, val) => setIgnoreStaticIP(val)} />
                    <Checkbox label={_("Ignore MAC address if set statically")} id="restore-dialog-ignoreStaticMAC"
                              name="ignoreStaticMAC" isChecked={ignoreStaticMAC}
                              onChange={(_, val) => setIgnoreStaticMAC(val)} />
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button variant="primary" isDisabled={inProgress}
                        isLoading={inProgress}
                        onClick={handleRestoreContainer}>
                    {_("Restore")}
                </Button>
                <Button variant="link" isDisabled={inProgress}
                        onClick={Dialogs.close}>
                    {_("Cancel")}
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export default ContainerRestoreModal;
