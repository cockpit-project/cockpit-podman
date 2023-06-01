import React from 'react';
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { Grid } from "@patternfly/react-core/dist/esm/layouts/Grid";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Popover } from "@patternfly/react-core/dist/esm/components/Popover";
import { MinusIcon, OutlinedQuestionCircleIcon } from '@patternfly/react-icons';
import cockpit from 'cockpit';

const _ = cockpit.gettext;

export const PublishPort = ({ id, item, onChange, idx, removeitem, itemCount }) =>
    (
        <Grid hasGutter id={id}>
            <FormGroup className="pf-m-6-col-on-md"
                label={_("IP address")}
                fieldId={id + "-ip-address"}
                labelIcon={
                    <Popover aria-label={_("IP address help")}
                        enableFlip
                        bodyContent={_("If host IP is set to 0.0.0.0 or not set at all, the port will be bound on all IPs on the host.")}>
                        <button onClick={e => e.preventDefault()} className="pf-v5-c-form__group-label-help">
                            <OutlinedQuestionCircleIcon />
                        </button>
                    </Popover>
                }>
                <TextInput id={id + "-ip-address"}
                        value={item.IP || ''}
                        onChange={(_event, value) => onChange(idx, 'IP', value)} />
            </FormGroup>
            <FormGroup className="pf-m-2-col-on-md"
                    label={_("Host port")}
                    fieldId={id + "-host-port"}
                    labelIcon={
                        <Popover aria-label={_("Host port help")}
                            enableFlip
                            bodyContent={_("If the host port is not set the container port will be randomly assigned a port on the host.")}>
                            <button onClick={e => e.preventDefault()} className="pf-v5-c-form__group-label-help">
                                <OutlinedQuestionCircleIcon />
                            </button>
                        </Popover>
                    }>
                <TextInput id={id + "-host-port"}
                            type='number'
                            step={1}
                            min={1}
                            max={65535}
                            value={item.hostPort || ''}
                            onChange={(_event, value) => onChange(idx, 'hostPort', value)} />
            </FormGroup>
            <FormGroup className="pf-m-2-col-on-md"
                        label={_("Container port")}
                        fieldId={id + "-container-port"} isRequired>
                <TextInput id={id + "-container-port"}
                            type='number'
                            step={1}
                            min={1}
                            max={65535}
                            value={item.containerPort || ''}
                            onChange={(_event, value) => onChange(idx, 'containerPort', value)} />
            </FormGroup>
            <FormGroup className="pf-m-2-col-on-md"
                        label={_("Protocol")}
                        fieldId={id + "-protocol"}>
                <FormSelect className='pf-v5-c-form-control container-port-protocol'
                            id={id + "-protocol"}
                            value={item.protocol}
                            onChange={(_event, value) => onChange(idx, 'protocol', value)}>
                    <FormSelectOption value='tcp' key='tcp' label={_("TCP")} />
                    <FormSelectOption value='udp' key='udp' label={_("UDP")} />
                </FormSelect>
            </FormGroup>
            <FormGroup className="pf-m-1-col-on-md remove-button-group">
                <Button variant='secondary'
                            className="btn-close"
                            id={id + "-btn-close"}
                            size="sm"
                            aria-label={_("Remove item")}
                            icon={<MinusIcon />}
                            onClick={() => removeitem(idx)} />
            </FormGroup>
        </Grid>
    );
