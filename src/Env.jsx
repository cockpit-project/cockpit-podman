import React from 'react';
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { Grid } from "@patternfly/react-core/dist/esm/layouts/Grid";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { TrashIcon } from '@patternfly/react-icons';
import cockpit from 'cockpit';

const _ = cockpit.gettext;

const handleEnvValue = (key, value, idx, onChange, additem, itemCount, companionField) => {
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

export const EnvVar = ({ id, item, onChange, idx, removeitem, additem, itemCount }) =>
    (
        <Grid hasGutter id={id}>
            <FormGroup className="pf-m-6-col-on-md" label={_("Key")} fieldId={id + "-key-address"}>
                <TextInput id={id + "-key"}
                       value={item.envKey || ''}
                       onChange={(_, value) => handleEnvValue('envKey', value, idx, onChange, additem, itemCount, item.envValue)} />
            </FormGroup>
            <FormGroup className="pf-m-6-col-on-md" label={_("Value")} fieldId={id + "-value-address"}>
                <TextInput id={id + "-value"}
                       value={item.envValue || ''}
                       onChange={(_, value) => handleEnvValue('envValue', value, idx, onChange, additem, itemCount, item.envKey)} />
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
