/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { EmptyState, EmptyStateBody } from "@patternfly/react-core/dist/esm/components/EmptyState";
import { FormFieldGroup, FormFieldGroupHeader, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { HelperText, HelperTextItem } from "@patternfly/react-core/dist/esm/components/HelperText";
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

export function parseEnvFile(contents) {
    const entries = new Map();
    const errors = [];

    contents.split(/\r\n|\n|\r/).forEach((line, index) => {
        let entry = line.trim();
        if (!entry || entry.startsWith("#"))
            return;

        if (entry.startsWith("export "))
            entry = entry.slice(7).trimStart();

        const separator = entry.indexOf('=');
        if (separator < 0) {
            errors.push({ line: index + 1, error: _("Expected KEY=VALUE") });
            return;
        }

        const key = entry.slice(0, separator).trim();
        const keyError = validateEnvVar(key, "envKey");
        if (keyError) {
            errors.push({ line: index + 1, error: keyError });
            return;
        }

        let value = entry.slice(separator + 1).trim();
        if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))))
            value = value.slice(1, -1);

        entries.set(key, value);
    });

    return {
        entries: Array.from(entries, ([envKey, envValue]) => ({ envKey, envValue })),
        errors,
    };
}

const handleEnvValue = (key, value, idx, onChange, additem, itemCount, companionField) => {
    // Allow the input of KEY=VALUE separated value pairs for bulk import only if the other
    // field is not empty.
    if (value.includes('=') && !companionField) {
        const parts = value.trim().split(" ");
        for (const [i, part] of parts.entries()) {
            const [envKey, ...envVar] = part.split('=');
            if (!envKey || !envVar) {
                continue;
            }

            let index;
            if (i > 0) {
                additem();
                index = itemCount - 1 + i; // additem always adds at the end
            } else {
                index = idx;
            }

            onChange(index, 'envKey', envKey);
            onChange(index, 'envValue', envVar.join('='));
        }
    } else {
        onChange(idx, key, value);
    }
};

export const EnvVar = ({ id, item, onChange, idx, removeitem, additem, options, validationFailed, onValidationChange }) =>
    (
        <Grid hasGutter id={id}>
            <FormGroup className="pf-m-6-col-on-md"
                id={`${id}-key-group`}
                label={_("Key")}
                fieldId={`${id}-key-address`}
                isRequired
            >
                <TextInput id={`${id}-key`}
                       value={item.envKey || ''}
                       validated={validationFailed?.envKey ? "error" : "default"}
                       onChange={(_event, value) => {
                           utils.validationClear(validationFailed, "envKey", onValidationChange);
                           utils.validationDebounce(() => onValidationChange({ ...validationFailed, envKey: validateEnvVar(value, "envKey") }));
                           handleEnvValue('envKey', value, idx, onChange, additem, options.itemCount, item.envValue);
                       }} />
                <FormHelper helperTextInvalid={validationFailed?.envKey} />
            </FormGroup>
            <FormGroup className="pf-m-6-col-on-md"
                id={`${id}-value-group`}
                label={_("Value")}
                fieldId={`${id}-value-address`}
            >
                <TextInput id={`${id}-value`}
                       value={item.envValue || ''}
                       validated={validationFailed?.envValue ? "error" : "default"}
                       onChange={(_event, value) => {
                           utils.validationClear(validationFailed, "envValue", onValidationChange);
                           utils.validationDebounce(() => onValidationChange({ ...validationFailed, envValue: validateEnvVar(value, "envValue") }));
                           handleEnvValue('envValue', value, idx, onChange, additem, options.itemCount, item.envKey);
                       }} />
                <FormHelper helperTextInvalid={validationFailed?.envValue} />
            </FormGroup>
            <FormGroup className="pf-m-1-col-on-md remove-button-group">
                <Button variant='plain'
                    className="btn-close"
                    id={`${id}-btn-close`}
                    size="sm"
                    aria-label={_("Remove item")}
                    icon={<TrashIcon />}
                    onClick={() => removeitem(idx)} />
            </FormGroup>
        </Grid>
    );

export const EnvList = ({ id, items, validationFailed, onValidationChange, onChange }) => {
    const additem = () => onChange(list => [...list, { envKey: null, envValue: null }]);

    const removeitem = idx => {
        onChange(list => {
            const newItems = [...list];
            delete newItems[idx];
            return newItems;
        });

        const newValidation = validationFailed ? [...validationFailed] : [];
        delete newValidation[idx];
        onValidationChange(newValidation);
    };

    const onItemChange = (idx, field, value) => onChange(list => {
        const newItems = [...list];
        newItems[idx] = { ...newItems[idx], [field]: value || null };
        return newItems;
    });

    return (
        <FormFieldGroup header={
            <FormFieldGroupHeader
                titleText={{ text: _("Environment variables"), id: `${id}-title` }}
                actions={<Button variant="secondary" className="btn-add" onClick={additem}>{_("Add variable")}</Button>}
            />
        } className="dynamic-form-group env-form">
            {items.some(item => item !== undefined)
                ? <>
                    {items.map((item, idx) => {
                        if (item === undefined)
                            return null;

                        return <EnvVar
                            key={idx}
                            id={`${id}-${idx}`}
                            item={item}
                            idx={idx}
                            onChange={onItemChange}
                            additem={additem}
                            removeitem={removeitem}
                            options={{ itemCount: items.length }}
                            validationFailed={validationFailed?.[idx]}
                            onValidationChange={value => {
                                const newValidation = validationFailed ? [...validationFailed] : [];
                                newValidation[idx] = value;
                                if (Object.keys(value).length === 0)
                                    delete newValidation[idx];
                                onValidationChange(newValidation);
                            }}
                        />;
                    })}
                    <HelperText>
                        <HelperTextItem>{_("Paste one or more lines of key=value pairs into any field for bulk import")}</HelperTextItem>
                    </HelperText>
                </>
                : <EmptyState><EmptyStateBody>{_("No environment variables specified")}</EmptyStateBody></EmptyState>}
        </FormFieldGroup>
    );
};
