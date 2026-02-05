/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Radio } from "@patternfly/react-core/dist/esm/components/Radio";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { FormHelper } from 'cockpit-components-form-helper.jsx';
import { useDialogs } from "dialogs.jsx";
import * as dockerNames from 'docker-names';

import cockpit from 'cockpit';
import { DynamicListForm } from 'cockpit-components-dynamic-list.jsx';

import { ErrorNotification } from './Notification.jsx';
import { PublishPort, validatePublishPort } from './PublishPort.jsx';
import { Volume } from './Volume.jsx';
import * as client from './client.js';
import * as utils from './util.js';

const _ = cockpit.gettext;

export const PodCreateModal = ({ users }) => {
    const { version, selinuxAvailable } = utils.usePodmanInfo();
    const [podName, setPodName] = useState(dockerNames.getRandomName());
    const [publish, setPublish] = useState([]);
    const [volumes, setVolumes] = useState([]);
    const [owner, setOwner] = useState(users[0]);
    const [inProgress, setInProgress] = useState(false);
    const [dialogError, setDialogError] = useState(null);
    const [dialogErrorDetail, setDialogErrorDetail] = useState(null);
    const [validationFailed, setValidationFailed] = useState({});
    const Dialogs = useDialogs();

    const getCreateConfig = () => {
        const createConfig = {};

        if (podName)
            createConfig.name = podName;

        if (publish.length > 0)
            createConfig.portmappings = publish
                    .filter(port => port?.containerPort)
                    .map(port => {
                        const pm = { container_port: parseInt(port.containerPort), protocol: port.protocol };
                        if (port.hostPort !== null)
                            pm.host_port = parseInt(port.hostPort);
                        if (port.IP !== null)
                            pm.host_ip = port.IP;
                        return pm;
                    });

        if (volumes.length > 0) {
            createConfig.mounts = volumes
                    .filter(volume => volume?.hostPath && volume?.containerPath)
                    .map(volume => {
                        const record = { source: volume.hostPath, destination: volume.containerPath, type: "bind" };
                        record.options = [];
                        if (volume.mode)
                            record.options.push(volume.mode);
                        if (volume.selinux)
                            record.options.push(volume.selinux);
                        return record;
                    });
        }

        return createConfig;
    };

    /* Updates a validation object of the whole dynamic list's form (e.g. the whole port-mapping form)
    *
    * Arguments
    *   - key: [publish/volumes/env] - Specifies the validation of which dynamic form of the Image run dialog is being updated
    *   - value: An array of validation errors of the form. Each item of the array represents a row of the dynamic list.
    *            Index needs to correlate with a row number
    */
    const dynamicListOnValidationChange = (key, value) => {
        setValidationFailed(prevState => {
            const newState = Object.assign({}, prevState, { [key]: value });
            if (newState[key].every(a => a === undefined))
                delete newState[key];
            return newState;
        });
    };

    const onCreateClicked = () => {
        if (!validateForm())
            return;
        setInProgress(true);
        client.createPod(owner.con, getCreateConfig())
                .then(Dialogs.close)
                .catch(ex => {
                    setInProgress(false);
                    setDialogError(_("Pod failed to be created"));
                    setDialogErrorDetail(cockpit.format("$0: $1", ex.reason, ex.message));
                });
    };

    const isFormInvalid = validationFailed => {
        function publishGroupHasError(row, idx) {
            // We always ignore errors for empty slots in
            // publish. Errors for these slots might show up when the
            // debounced validation runs after a row has been removed.
            if (!row || !publish[idx])
                return false;

            return Object.values(row)
                    .filter(val => val) // Filter out empty/undefined properties
                    .length > 0; // If one field has error, the whole group (dynamicList) is invalid
        }

        // If at least one group is invalid, then the whole form is invalid
        return validationFailed.publish?.some(publishGroupHasError) ||
            !!validationFailed.podName;
    };

    const validatePodName = value => {
        if (!utils.is_valid_container_name(value))
            return _("Invalid characters. Name can only contain letters, numbers, and certain punctuation (_ . -).");
    };

    const validateForm = () => {
        const newValidationFailed = { };

        const publishValidation = publish.map(a => {
            if (a === undefined)
                return undefined;

            return {
                IP: validatePublishPort(a.IP, "IP"),
                hostPort: validatePublishPort(a.hostPort, "hostPort"),
                containerPort: validatePublishPort(a.containerPort, "containerPort"),
            };
        });
        if (publishValidation.some(entry => entry && Object.keys(entry).length > 0))
            newValidationFailed.publish = publishValidation;

        const podNameValidation = validatePodName(podName);

        if (podNameValidation)
            newValidationFailed.containerName = podNameValidation;

        setValidationFailed(newValidationFailed);
        return !isFormInvalid(newValidationFailed);
    };

    const defaultBody = (
        <Form>
            {dialogError && <ErrorNotification errorMessage={dialogError} errorDetail={dialogErrorDetail} />}
            <FormGroup id="pod-name-group" fieldId='create-pod-dialog-name' label={_("Name")} className="ct-m-horizontal">
                <TextInput id='create-pod-dialog-name'
                           className="pod-name"
                           placeholder={_("Pod name")}
                           value={podName}
                           validated={validationFailed.podName ? "error" : "default"}
                           onChange={(_, value) => {
                               utils.validationClear(validationFailed, "podName", (value) => setValidationFailed(value));
                               utils.validationDebounce(() => {
                                   const delta = validatePodName(value);
                                   if (delta)
                                       setValidationFailed(prevState => { return { ...prevState, podName: delta } });
                               });
                               setPodName(value);
                           }} />
                <FormHelper fieldId="create-pod-dialog-name" helperTextInvalid={validationFailed?.podName} />
            </FormGroup>
            { users.length > 1 &&
                <FormGroup isInline hasNoPaddingTop fieldId='create-pod-dialog-owner' label={_("Owner")} className="ct-m-horizontal">
                    { users.map(user => (
                        <Radio key={user.name}
                            value={user.name}
                            label={user.uid === 0 ? _("System") : cockpit.format("$0 $1", _("User:"), user.name)}
                            id={"create-pod-dialog-owner-" + user.name }
                            isChecked={owner === user}
                            onChange={() => setOwner(user)} />))
                    }
                </FormGroup>
            }
            <DynamicListForm id='create-pod-dialog-publish'
                        emptyStateString={_("No ports exposed")}
                        formclass='publish-port-form'
                        label={_("Port mapping")}
                        actionLabel={_("Add port mapping")}
                        validationFailed={validationFailed.publish}
                        onValidationChange={value => dynamicListOnValidationChange('publish', value)}
                        onChange={value => setPublish(value)}
                        default={{ IP: null, containerPort: null, hostPort: null, protocol: 'tcp' }}
                        itemcomponent={PublishPort} />

            {version.localeCompare("4", undefined, { numeric: true, sensitivity: 'base' }) >= 0 &&
                <DynamicListForm id='create-pod-dialog-volume'
                            emptyStateString={_("No volumes specified")}
                            formclass='volume-form'
                            label={_("Volumes")}
                            actionLabel={_("Add volume")}
                            onChange={value => setVolumes(value)}
                            default={{ containerPath: null, hostPath: null, mode: 'rw' }}
                            options={{ selinuxAvailable }}
                            itemcomponent={Volume} />
            }

        </Form>
    );

    return (
        <Modal isOpen
                position="top" variant="medium"
                onClose={Dialogs.close}
                onEscapePress={Dialogs.close}
        >
            <ModalHeader title={_("Create pod")} />
            <ModalBody>
                {defaultBody}
            </ModalBody>
            <ModalFooter>
                <Button variant='primary' id="create-pod-create-btn" onClick={onCreateClicked}
                        isLoading={inProgress}
                        isDisabled={isFormInvalid(validationFailed) || inProgress}>
                    {_("Create")}
                </Button>
                <Button variant='link' className='btn-cancel' isDisabled={inProgress} onClick={Dialogs.close}>
                    {_("Cancel")}
                </Button>
            </ModalFooter>
        </Modal>
    );
};
