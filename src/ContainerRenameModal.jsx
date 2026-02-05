/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { FormHelper } from 'cockpit-components-form-helper.jsx';
import { useDialogs } from "dialogs.jsx";

import cockpit from 'cockpit';

import { ErrorNotification } from './Notification.jsx';
import * as client from './client.js';
import * as utils from './util.js';

const _ = cockpit.gettext;

const ContainerRenameModal = ({ con, container, updateContainer }) => {
    const Dialogs = useDialogs();
    const [name, setName] = useState(container.Name);
    const { version } = utils.usePodmanInfo();
    const [nameError, setNameError] = useState(null);
    const [dialogError, setDialogError] = useState(null);
    const [dialogErrorDetail, setDialogErrorDetail] = useState(null);

    const handleInputChange = (targetName, value) => {
        if (targetName === "name") {
            setName(value);
            if (value === "") {
                setNameError(_("Container name is required."));
            } else if (utils.is_valid_container_name(value)) {
                setNameError(null);
            } else {
                setNameError(_("Invalid characters. Name can only contain letters, numbers, and certain punctuation (_ . -)."));
            }
        }
    };

    const handleRename = () => {
        if (!name) {
            setNameError(_("Container name is required."));
            return;
        }

        setNameError(null);
        setDialogError(null);
        client.renameContainer(con, container.Id, { name })
                .then(() => {
                    Dialogs.close();
                    // HACK: This is a workaround for missing API rename event in Podman versions less than 4.1.
                    if (version.localeCompare("4.1", undefined, { numeric: true, sensitivity: 'base' }) < 0) {
                        updateContainer(con, container.Id); // not-covered: only on old version
                    }
                })
                .catch(ex => {
                    setDialogError(cockpit.format(_("Failed to rename container $0"), container.Name)); // not-covered: OS error
                    setDialogErrorDetail(cockpit.format("$0: $1", ex.message, ex.reason));
                });
    };

    const handleKeyDown = (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleRename();
        }
    };

    const renameContent = (
        <Form isHorizontal>
            <FormGroup fieldId="rename-dialog-container-name" label={_("New container name")}>
                <TextInput id="rename-dialog-container-name"
                        value={name}
                        validated={nameError ? "error" : "default"}
                        type="text"
                        aria-label={nameError}
                        onChange={(_, value) => handleInputChange("name", value)} />
                <FormHelper fieldId="commit-dialog-image-name" helperTextInvalid={nameError} />
            </FormGroup>
        </Form>
    );

    return (
        <Modal isOpen
            position="top" variant="medium"
            onClose={Dialogs.close}
            onKeyDown={handleKeyDown}
        >
            <ModalHeader title={cockpit.format(_("Rename container $0"), container.Name)} />
            <ModalBody>
                {dialogError && <ErrorNotification errorMessage={dialogError} errorDetail={dialogErrorDetail} onDismiss={() => setDialogError(null)} />}
                {renameContent}
            </ModalBody>
            <ModalFooter>
                <Button variant="primary"
                        className="btn-ctr-rename"
                        id="btn-rename-dialog-container"
                        isDisabled={nameError}
                        onClick={handleRename}>
                    {_("Rename")}
                </Button>
                <Button variant="link"
                        className="btn-ctr-cancel-commit"
                        onClick={Dialogs.close}>
                    {_("Cancel")}
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export default ContainerRenameModal;
