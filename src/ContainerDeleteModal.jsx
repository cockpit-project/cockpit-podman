/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { useDialogs } from "dialogs.jsx";

import cockpit from 'cockpit';

import * as client from './client.js';

const _ = cockpit.gettext;

const ContainerDeleteModal = ({ con, containerWillDelete, onAddNotification }) => {
    const Dialogs = useDialogs();

    const handleRemoveContainer = () => {
        const container = containerWillDelete;
        const id = container ? container.Id : "";

        Dialogs.close();
        client.delContainer(con, id, false)
                .catch(ex => {
                    const error = cockpit.format(_("Failed to remove container $0"), container.Name); // not-covered: OS error
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                });
    };

    return (
        <Modal isOpen
               position="top" variant="medium"
               onClose={Dialogs.close}
        >
            <ModalHeader title={cockpit.format(_("Delete $0?"), containerWillDelete.Name)}
                titleIconVariant="warning"
            />
            <ModalBody>
                {_("Deleting a container will erase all data in it.")}
            </ModalBody>
            <ModalFooter>
                <Button variant="danger" className="btn-ctr-delete" onClick={handleRemoveContainer}>{_("Delete")}</Button>{' '}
                <Button variant="link" onClick={Dialogs.close}>{_("Cancel")}</Button>
            </ModalFooter>
        </Modal>
    );
};

export default ContainerDeleteModal;
