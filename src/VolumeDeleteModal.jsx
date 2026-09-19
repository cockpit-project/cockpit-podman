/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { useDialogs } from "dialogs.jsx";

import cockpit from 'cockpit';

import * as client from './client.js';

const _ = cockpit.gettext;

export const VolumeDeleteModal = ({ con, volume }) => {
    const [force, setForce] = useState(false);
    const [reason, setReason] = useState(null);
    const Dialogs = useDialogs();

    const handleRemoveVolume = async () => {
        setReason(null);
        try {
            await client.deleteVolume(con, volume.Name, force);
            Dialogs.close();
        } catch (exc) {
            setReason(exc.message);
            setForce(true);
        }
    };

    return (
        <Modal isOpen
                 position="top" variant="medium"
                 onClose={Dialogs.close}
        >
            <ModalHeader title={cockpit.format(_("Delete $0 volume?"), volume.Name)}
                titleIconVariant="warning"
            />
            <ModalBody>
                {reason}
            </ModalBody>
            <ModalFooter>
                <Button id="btn-volume-delete" variant="danger"
                        onClick={() => handleRemoveVolume()}>
                    {force ? _("Force delete volume") : _("Delete volume")}
                </Button>
                <Button variant="link" onClick={Dialogs.close}>{_("Cancel")}</Button>
            </ModalFooter>
        </Modal>
    );
};
