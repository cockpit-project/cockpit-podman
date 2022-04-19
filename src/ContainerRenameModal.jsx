import React, { useState } from 'react';
import {
    Button,
    Form, FormGroup,
    Modal, TextInput
} from '@patternfly/react-core';
import cockpit from 'cockpit';

import * as client from './client.js';
import { ErrorNotification } from './Notification.jsx';

const _ = cockpit.gettext;

const ContainerRenameModal = ({ container, version, onHide, updateContainerAfterEvent }) => {
    const [name, setName] = useState(container.Names[0]);
    const [nameError, setNameError] = useState(null);
    const [dialogError, setDialogError] = useState(null);
    const [dialogErrorDetail, setDialogErrorDetail] = useState(null);

    const handleInputChange = (targetName, value) => {
        if (targetName === "name") {
            setName(value);
            if (value === "") {
                setNameError(_("Container name is required."));
            } else if (/^[a-zA-Z0-9][a-zA-Z0-9_\\.-]*$/.test(value)) {
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
        client.renameContainer(container.isSystem, container.Id, { name })
                .then(() => {
                    onHide();
                    // HACK: This is a workaround for missing API rename event in Podman versions less than 4.1.
                    if (version.localeCompare("4.1", undefined, { numeric: true, sensitivity: 'base' }) < 0) {
                        updateContainerAfterEvent(container.Id, container.isSystem);
                    }
                })
                .catch(ex => {
                    setDialogError(cockpit.format(_("Failed to rename container $0"), container.Names[0]));
                    setDialogErrorDetail(cockpit.format("$0: $1", ex.message, ex.reason));
                });
    };

    const handleKeyPress = (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleRename(name);
        }
    };

    const renameContent =
        <Form isHorizontal>
            <FormGroup fieldId="rename-dialog-container-name" label={_("New container name")}
                    validated={nameError ? "error" : "default"}
                    helperTextInvalid={nameError}>
                <TextInput id="rename-dialog-container-name"
                        value={name}
                        validated={nameError ? "error" : "default"}
                        type="text"
                        aria-label={nameError}
                        onChange={value => handleInputChange("name", value)} />
            </FormGroup>
        </Form>;

    return (
        <Modal isOpen
            position="top" variant="medium"
            onClose={onHide}
            onKeyPress={handleKeyPress}
            title={cockpit.format(_("Rename container $0"), container.Names[0])}
            footer={<>
                <Button variant="primary"
                        className="btn-ctr-rename"
                        id="btn-rename-dialog-container"
                        isDisabled={nameError}
                        onClick={handleRename}>
                    {_("Rename")}
                </Button>
                <Button variant="link"
                        className="btn-ctr-cancel-commit"
                        onClick={onHide}>
                    {_("Cancel")}
                </Button>
            </>}
        >
            {dialogError && <ErrorNotification errorMessage={dialogError} errorDetail={dialogErrorDetail} onDismiss={() => setDialogError(null)} />}
            {renameContent}
        </Modal>
    );
};

export default ContainerRenameModal;
