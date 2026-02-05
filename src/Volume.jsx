/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Grid } from "@patternfly/react-core/dist/esm/layouts/Grid";
import { TrashIcon } from '@patternfly/react-icons';
import { FormHelper } from "cockpit-components-form-helper.jsx";

import cockpit from 'cockpit';
import { FileAutoComplete } from 'cockpit-components-file-autocomplete.jsx';

import * as utils from './util.js';

const _ = cockpit.gettext;

export function validateVolume(value, key) {
    switch (key) {
    case "hostPath":
        break;
    case "containerPath":
        if (!value)
            return _("Container path must not be empty");

        break;
    default:
        console.error(`Unknown key "${key}"`); // not-covered: unreachable assertion
    }
}

export const Volume = ({ id, item, onChange, idx, removeitem, _additem, options, _itemCount, validationFailed, onValidationChange }) =>
    (
        <Grid hasGutter id={id}>
            <FormGroup className="pf-m-4-col-on-md"
                id={id + "-host-path-group"}
                label={_("Host path")}
                fieldId={id + "-host-path"}
            >
                <FileAutoComplete id={id + "-host-path"}
                    value={item.hostPath || ''}
                    onChange={value => {
                        utils.validationClear(validationFailed, "hostPath", onValidationChange);
                        utils.validationDebounce(() => onValidationChange({ ...validationFailed, hostPath: validateVolume(value, "hostPath") }));
                        onChange(idx, 'hostPath', value);
                    }} />
                <FormHelper helperTextInvalid={validationFailed?.hostPath} />
            </FormGroup>
            <FormGroup className="pf-m-3-col-on-md"
                id={id + "-container-path-group"}
                label={_("Container path")}
                fieldId={id + "-container-path"}
                isRequired
            >
                <TextInput id={id + "-container-path"}
                    value={item.containerPath || ''}
                    validated={validationFailed?.containerPath ? "error" : "default"}
                    onChange={(_event, value) => {
                        utils.validationClear(validationFailed, "containerPath", onValidationChange);
                        utils.validationDebounce(() => onValidationChange({ ...validationFailed, containerPath: validateVolume(value, "containerPath") }));
                        onChange(idx, 'containerPath', value);
                    }} />
                <FormHelper helperTextInvalid={validationFailed?.containerPath} />
            </FormGroup>
            <FormGroup className="pf-m-2-col-on-md" label={_("Mode")} fieldId={id + "-mode"}>
                <Checkbox id={id + "-mode"}
                    label={_("Writable")}
                    isChecked={item.mode == "rw"}
                    onChange={(_event, value) => onChange(idx, 'mode', value ? "rw" : "ro")} />
            </FormGroup>
            { options && options.selinuxAvailable &&
            <FormGroup className="pf-m-3-col-on-md" label={_("SELinux")} fieldId={id + "-selinux"}>
                <FormSelect id={id + "-selinux"} className='pf-v6-c-form-control'
                            value={item.selinux}
                            onChange={(_event, value) => onChange(idx, 'selinux', value)}>
                    <FormSelectOption value='' key='' label={_("No label")} />
                    <FormSelectOption value='z' key='z' label={_("Shared")} />
                    <FormSelectOption value='Z' key='Z' label={_("Private")} />
                </FormSelect>
            </FormGroup> }
            <FormGroup className="pf-m-1-col-on-md remove-button-group">
                <Button variant='plain'
                    className="btn-close"
                    id={id + "-btn-close"}
                    aria-label={_("Remove item")}
                    size="sm"
                    icon={<TrashIcon />}
                    onClick={() => removeitem(idx)} />
            </FormGroup>
        </Grid>
    );
