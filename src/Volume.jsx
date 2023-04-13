import React from 'react';
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { Grid } from "@patternfly/react-core/dist/esm/layouts/Grid";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { MinusIcon } from '@patternfly/react-icons';
import { FileAutoComplete } from 'cockpit-components-file-autocomplete.jsx';
import cockpit from 'cockpit';

const _ = cockpit.gettext;

export const Volume = ({ id, item, onChange, idx, removeitem, additem, options, itemCount }) =>
    (
        <Grid hasGutter id={id}>
            <FormGroup className="pf-m-4-col-on-md" label={_("Host path")} fieldId={id + "-host-path"}>
                <FileAutoComplete id={id + "-host-path"}
                    value={item.hostPath || ''}
                    onChange={ value => onChange(idx, 'hostPath', value) } />
            </FormGroup>
            <FormGroup className="pf-m-3-col-on-md" label={_("Container path")} fieldId={id + "-container-path"}>
                <TextInput id={id + "-container-path"}
                    value={item.containerPath || ''}
                    onChange={value => onChange(idx, 'containerPath', value)} />
            </FormGroup>
            <FormGroup className="pf-m-2-col-on-md" label={_("Mode")} fieldId={id + "-mode"}>
                <Checkbox id={id + "-mode"}
                    label={_("Writable")}
                    isChecked={item.mode == "rw"}
                    onChange={(_event, value) => onChange(idx, 'mode', value ? "rw" : "ro")} />
            </FormGroup>
            { options && options.selinuxAvailable &&
            <FormGroup className="pf-m-3-col-on-md" label={_("SELinux")} fieldId={id + "-selinux"}>
                <FormSelect id={id + "-selinux"} className='pf-c-form-control'
                            value={item.selinux}
                            onChange={value => onChange(idx, 'selinux', value)}>
                    <FormSelectOption value='' key='' label={_("No label")} />
                    <FormSelectOption value='z' key='z' label={_("Shared")} />
                    <FormSelectOption value='Z' key='Z' label={_("Private")} />
                </FormSelect>
            </FormGroup> }
            <FormGroup className="pf-m-1-col-on-md remove-button-group">
                <Button variant='secondary'
                    className="btn-close"
                    id={id + "-btn-close"}
                    aria-label={_("Remove item")}
                    size="sm"
                    icon={<MinusIcon />}
                    onClick={() => removeitem(idx)} />
            </FormGroup>
        </Grid>
    );
