/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Grid } from "@patternfly/react-core/dist/esm/layouts/Grid";
import { TrashIcon } from '@patternfly/react-icons';
import { FormHelper } from "cockpit-components-form-helper.jsx";

import cockpit from 'cockpit';

import * as utils from './util.js';

const _ = cockpit.gettext;

export function validateEnvVar(env, key) {
    const re = /^[a-zA-Z_]{1,}[a-zA-Z0-9_]*$/;
    switch (key) {
    case "envKey":
        if (!env)
            return _("Key must not be empty");
        if (/^\d/.test(env))
            return _("Key must not begin with a digit");
        if (!re.test(env))
            return _("Key contains invalid characters");
        break;
    case "envValue":
        break;
    default:
        console.error(`Unknown key "${key}"`); // not-covered: unreachable assertion
    }
}

const handleEnvValue = (key, value, idx, onChange, additem, _itemCount, companionField) => {
    // Allow the input of KEY=VALUE separated value pairs for bulk import only if the other
    // field is not empty.
    if (value.includes('=') && !companionField) {
        const parts = value.trim().split(" ");
        let index = idx;
        for (const part of parts) {
            const [envKey, ...envVar] = part.split('=');
            if (!envKey || !envVar) {
                continue;
            }

            if (index !== idx) {
                additem();
            }
            onChange(index, 'envKey', envKey);
            onChange(index, 'envValue', envVar.join('='));
            index++;
        }
    } else {
        onChange(idx, key, value);
    }
};

export const EnvVar = ({ id, item, onChange, idx, removeitem, additem, itemCount, validationFailed, onValidationChange }) =>
    (
        <Grid hasGutter id={id}>
            <FormGroup className="pf-m-6-col-on-md"
                id={id + "-key-group"}
                label={_("Key")}
                fieldId={id + "-key-address"}
                isRequired
            >
                <TextInput id={id + "-key"}
                       value={item.envKey || ''}
                       validated={validationFailed?.envKey ? "error" : "default"}
                       onChange={(_event, value) => {
                           utils.validationClear(validationFailed, "envKey", onValidationChange);
                           utils.validationDebounce(() => onValidationChange({ ...validationFailed, envKey: validateEnvVar(value, "envKey") }));
                           handleEnvValue('envKey', value, idx, onChange, additem, itemCount, item.envValue);
                       }} />
                <FormHelper helperTextInvalid={validationFailed?.envKey} />
            </FormGroup>
            <FormGroup className="pf-m-6-col-on-md"
                id={id + "-value-group"}
                label={_("Value")}
                fieldId={id + "-value-address"}
            >
                <TextInput id={id + "-value"}
                       value={item.envValue || ''}
                       validated={validationFailed?.envValue ? "error" : "default"}
                       onChange={(_event, value) => {
                           utils.validationClear(validationFailed, "envValue", onValidationChange);
                           utils.validationDebounce(() => onValidationChange({ ...validationFailed, envValue: validateEnvVar(value, "envValue") }));
                           handleEnvValue('envValue', value, idx, onChange, additem, itemCount, item.envKey);
                       }} />
                <FormHelper helperTextInvalid={validationFailed?.envValue} />
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
