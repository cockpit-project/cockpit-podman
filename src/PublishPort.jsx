/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { Popover } from "@patternfly/react-core/dist/esm/components/Popover";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Grid } from "@patternfly/react-core/dist/esm/layouts/Grid";
import { OutlinedQuestionCircleIcon, TrashIcon } from '@patternfly/react-icons';
import { FormHelper } from "cockpit-components-form-helper.jsx";
import ipaddr from "ipaddr.js";

import cockpit from 'cockpit';

import * as utils from './util.js';

const _ = cockpit.gettext;

const MAX_PORT = 65535;

export function validatePublishPort(value, key) {
    switch (key) {
    case "IP":
        if (value && !ipaddr.isValid(value))
            return _("Must be a valid IP address");
        break;
    case "hostPort": {
        if (value) {
            const hostPort = parseInt(value);
            if (hostPort < 1 || hostPort > MAX_PORT)
                return _("1 to 65535");
        }

        break;
    }
    case "containerPort": {
        if (!value)
            return _("Container port must not be empty");

        const containerPort = parseInt(value);
        if (containerPort < 1 || containerPort > MAX_PORT)
            return _("1 to 65535");

        break;
    }
    default:
        console.error(`Unknown key "${key}"`); // not-covered: unreachable assertion
    }
}

export const PublishPort = ({ id, item, onChange, idx, removeitem, _itemCount, validationFailed, onValidationChange }) =>
    (
        <Grid hasGutter id={id}>
            <FormGroup className="pf-m-5-col-on-md"
                id={id + "-ip-address-group"}
                label={_("IP address")}
                fieldId={id + "-ip-address"}
                labelHelp={
                    <Popover aria-label={_("IP address help")}
                        enableFlip
                        bodyContent={_("If host IP is set to 0.0.0.0 or not set at all, the port will be bound on all IPs on the host.")}>
                        <Button variant="plain" hasNoPadding aria-label="More info" icon={<OutlinedQuestionCircleIcon />} />
                    </Popover>
                }>
                <TextInput id={id + "-ip-address"}
                        value={item.IP || ''}
                        validated={validationFailed?.IP ? "error" : "default"}
                        onChange={(_event, value) => {
                            utils.validationClear(validationFailed, "IP", onValidationChange);
                            utils.validationDebounce(() => onValidationChange({ ...validationFailed, IP: validatePublishPort(value, "IP") }));
                            onChange(idx, 'IP', value);
                        }} />
                <FormHelper helperTextInvalid={validationFailed?.IP} />
            </FormGroup>
            <FormGroup className="pf-m-2-col-on-md"
                    id={id + "-host-port-group"}
                    label={_("Host port")}
                    fieldId={id + "-host-port"}
                    labelHelp={
                        <Popover aria-label={_("Host port help")}
                            enableFlip
                            bodyContent={_("If the host port is not set the container port will be randomly assigned a port on the host.")}>
                            <Button variant="plain" hasNoPadding aria-label="More info" icon={<OutlinedQuestionCircleIcon />} />
                        </Popover>
                    }>
                <TextInput id={id + "-host-port"}
                            type='number'
                            step={1}
                            min={1}
                            max={MAX_PORT}
                            value={item.hostPort || ''}
                            validated={validationFailed?.hostPort ? "error" : "default"}
                            onChange={(_event, value) => {
                                utils.validationClear(validationFailed, "hostPort", onValidationChange);
                                utils.validationDebounce(() => onValidationChange({ ...validationFailed, hostPort: validatePublishPort(value, "hostPort") }));
                                onChange(idx, 'hostPort', value);
                            }} />
                <FormHelper helperTextInvalid={validationFailed?.hostPort} />
            </FormGroup>
            <FormGroup className="pf-m-3-col-on-md"
                        id={id + "-container-port-group"}
                        label={_("Container port")}
                        fieldId={id + "-container-port"} isRequired>
                <TextInput id={id + "-container-port"}
                            type='number'
                            step={1}
                            min={1}
                            max={MAX_PORT}
                            validated={validationFailed?.containerPort ? "error" : "default"}
                            value={item.containerPort || ''}
                            onChange={(_event, value) => {
                                utils.validationClear(validationFailed, "containerPort", onValidationChange);
                                utils.validationDebounce(() => onValidationChange({ ...validationFailed, containerPort: validatePublishPort(value, "containerPort") }));
                                onChange(idx, 'containerPort', value);
                            }} />
                <FormHelper helperTextInvalid={validationFailed?.containerPort} />
            </FormGroup>
            <FormGroup className="pf-m-2-col-on-md"
                        label={_("Protocol")}
                        fieldId={id + "-protocol"}>
                <FormSelect className='pf-v6-c-form-control container-port-protocol'
                            id={id + "-protocol"}
                            value={item.protocol}
                            onChange={(_event, value) => onChange(idx, 'protocol', value)}>
                    <FormSelectOption value='tcp' key='tcp' label={_("TCP")} />
                    <FormSelectOption value='udp' key='udp' label={_("UDP")} />
                </FormSelect>
            </FormGroup>
            <FormGroup className="pf-m-1-col-on-md remove-button-group">
                <Button variant='plain'
                            className="btn-close"
                            id={id + "-btn-close"}
                            size="sm"
                            aria-label={_("Remove item")}
                            icon={<TrashIcon />}
                            onClick={() => removeitem(idx)} />
            </FormGroup>
        </Grid>
    );
