import React from 'react';
import PropTypes from 'prop-types';
import {
    Button, Checkbox,
    EmptyState, EmptyStateBody,
    Form, FormGroup, FormFieldGroup, FormFieldGroupHeader,
    FormSelect, FormSelectOption,
    Grid,
    Modal, TextInput, Tabs, Tab, TabTitleText,
    Flex, FlexItem,
    Popover,
} from '@patternfly/react-core';
import { MinusIcon, OutlinedQuestionCircleIcon } from '@patternfly/react-icons';
import * as dockerNames from 'docker-names';

import { ErrorNotification } from './Notification.jsx';
import { FileAutoComplete } from 'cockpit-components-file-autocomplete.jsx';
import * as utils from './util.js';
import * as client from './client.js';
import cockpit from 'cockpit';

import "./ImageRunModal.scss";

const _ = cockpit.gettext;

const units = {
    KiB: {
        name: "KiB",
        base1024Exponent: 1,
    },
    MiB: {
        name: "MiB",
        base1024Exponent: 2,
    },
    GiB: {
        name: "GiB",
        base1024Exponent: 3,
    },
};

const PublishPort = ({ id, item, onChange, idx, removeitem, itemCount }) =>
    (
        <Grid hasGutter id={id}>
            <FormGroup className="pf-m-4-col-on-sm"
                label={_("IP address")}
                fieldId={id + "-ip-address"}
                labelIcon={
                    <Popover aria-label={_("IP address help")}
                        enableFlip
                        bodyContent={_("If host IP is set to 0.0.0.0 or not set at all, the port will be bound on all IPs on the host.")}>
                        <button onClick={e => e.preventDefault()} className="pf-c-form__group-label-help">
                            <OutlinedQuestionCircleIcon />
                        </button>
                    </Popover>
                }>
                <TextInput id={id + "-ip-address"}
                        value={item.IP || ''}
                        onChange={value => onChange(idx, 'IP', value)} />
            </FormGroup>
            <FormGroup className="pf-m-2-col-on-sm"
                    label={_("Host port")}
                    fieldId={id + "-host-port"}
                    labelIcon={
                        <Popover aria-label={_("Host port help")}
                            enableFlip
                            bodyContent={_("If the host port is not set the container port will be randomly assigned a port on the host.")}>
                            <button onClick={e => e.preventDefault()} className="pf-c-form__group-label-help">
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
                            onChange={value => onChange(idx, 'hostPort', value)} />
            </FormGroup>
            <FormGroup className="pf-m-3-col-on-sm"
                        label={_("Container port")}
                        fieldId={id + "-container-port"} isRequired>
                <TextInput id={id + "-container-port"}
                            type='number'
                            step={1}
                            min={1}
                            max={65535}
                            value={item.containerPort || ''}
                            onChange={value => onChange(idx, 'containerPort', value)} />
            </FormGroup>
            <FormGroup className="pf-m-2-col-on-sm"
                        label={_("Protocol")}
                        fieldId={id + "-protocol"}>
                <FormSelect className='pf-c-form-control container-port-protocol'
                            id={id + "-protocol"}
                            value={item.protocol}
                            onChange={value => onChange(idx, 'protocol', value)}>
                    <FormSelectOption value='tcp' key='tcp' label={_("TCP")} />
                    <FormSelectOption value='udp' key='udp' label={_("UDP")} />
                </FormSelect>
            </FormGroup>
            <FormGroup className="pf-m-1-col-on-sm remove-button-group">
                <Button variant='secondary'
                            className="btn-close"
                            id={id + "-btn-close"}
                            isSmall
                            aria-label={_("Remove item")}
                            icon={<MinusIcon />}
                            onClick={() => removeitem(idx)} />
            </FormGroup>
        </Grid>
    );

const EnvVar = ({ id, item, onChange, idx, removeitem, additem, itemCount }) =>
    (
        <Grid hasGutter id={id}>
            <FormGroup className="pf-m-5-col-on-sm" label={_("Key")} fieldId={id + "-key-address"}>
                <TextInput id={id + "-key"}
                       value={item.envKey || ''}
                       onChange={value => onChange(idx, 'envKey', value)} />
            </FormGroup>
            <FormGroup className="pf-m-5-col-on-sm" label={_("Value")} fieldId={id + "-value-address"}>
                <TextInput id={id + "-value"}
                       value={item.envValue || ''}
                       onChange={value => onChange(idx, 'envValue', value)} />
            </FormGroup>
            <FormGroup className="pf-m-1-col-on-sm remove-button-group">
                <Button variant='secondary'
                    className="btn-close"
                    id={id + "-btn-close"}
                    isSmall
                    aria-label={_("Remove item")}
                    icon={<MinusIcon />}
                    onClick={() => removeitem(idx)} />
            </FormGroup>
        </Grid>
    );

const Volume = ({ id, item, onChange, idx, removeitem, additem, options, itemCount }) =>
    (
        <Grid hasGutter id={id}>
            <FormGroup className="pf-m-3-col-on-sm" label={_("Host path")} fieldId={id + "-host-path"}>
                <FileAutoComplete id={id + "-host-path"}
                    value={item.hostPath || ''}
                    onChange={ value => onChange(idx, 'hostPath', value) } />
            </FormGroup>
            <FormGroup className="pf-m-3-col-on-sm" label={_("Container path")} fieldId={id + "-container-path"}>
                <TextInput id={id + "-container-path"}
                    value={item.containerPath || ''}
                    onChange={value => onChange(idx, 'containerPath', value)} />
            </FormGroup>
            <FormGroup className="pf-m-2-col-on-sm" label={_("Mode")} fieldId={id + "-mode"}>
                <Checkbox id={id + "-mode"}
                    label={_("Writable")}
                    isChecked={item.mode == "rw"}
                    onChange={value => onChange(idx, 'mode', value ? "rw" : "ro")} />
            </FormGroup>
            { options && options.selinuxAvailable &&
            <FormGroup className="pf-m-3-col-on-sm" label={_("SELinux")} fieldId={id + "-selinux"}>
                <FormSelect id={id + "-selinux"} className='pf-c-form-control'
                            value={item.selinux}
                            onChange={value => onChange(idx, 'selinux', value)}>
                    <FormSelectOption value='' key='' label={_("No label")} />
                    <FormSelectOption value='z' key='z' label={_("Shared")} />
                    <FormSelectOption value='Z' key='Z' label={_("Private")} />
                </FormSelect>
            </FormGroup> }
            <FormGroup className="pf-m-1-col-on-sm remove-button-group">
                <Button variant='secondary'
                    className="btn-close"
                    id={id + "-btn-close"}
                    aria-label={_("Remove item")}
                    isSmall
                    icon={<MinusIcon />}
                    onClick={() => removeitem(idx)} />
            </FormGroup>
        </Grid>
    );

class DynamicListForm extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            list: [],
        };
        this.keyCounter = 0;
        this.removeItem = this.removeItem.bind(this);
        this.addItem = this.addItem.bind(this);
        this.onItemChange = this.onItemChange.bind(this);
    }

    removeItem(idx, field, value) {
        this.setState(state => {
            const items = state.list.concat();
            items.splice(idx, 1);
            return { list: items };
        }, () => this.props.onChange(this.state.list.concat()));
    }

    addItem() {
        this.setState(state => {
            return { list: [...state.list, Object.assign({ key: this.keyCounter++ }, this.props.default)] };
        }, () => this.props.onChange(this.state.list.concat()));
    }

    onItemChange(idx, field, value) {
        this.setState(state => {
            const items = state.list.concat();
            items[idx][field] = value || null;
            return { list: items };
        }, () => this.props.onChange(this.state.list.concat()));
    }

    render () {
        const { id, label, actionLabel, formclass, emptyStateString } = this.props;
        const dialogValues = this.state;
        return (
            <FormFieldGroup header={
                <FormFieldGroupHeader
                    titleText={{ text: label }}
                    actions={<Button variant="secondary" className="btn-add" onClick={this.addItem}>{actionLabel}</Button>}
                />
            } className={"dynamic-form-group " + formclass}>
                {
                    dialogValues.list.length
                        ? dialogValues.list.map((item, idx) => {
                            return React.cloneElement(this.props.itemcomponent, {
                                idx: idx, item: item, id: id + "-" + idx,
                                onChange: this.onItemChange, removeitem: this.removeItem, additem: this.addItem, options: this.props.options,
                                itemCount: Object.keys(dialogValues.list).length,
                            });
                        })
                        : <EmptyState>
                            <EmptyStateBody>
                                {emptyStateString}
                            </EmptyStateBody>
                        </EmptyState>
                }
            </FormFieldGroup>
        );
    }
}
DynamicListForm.propTypes = {
    emptyStateString: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    id: PropTypes.string.isRequired,
    itemcomponent: PropTypes.object.isRequired,
    formclass: PropTypes.string,
    options: PropTypes.object,
};

export class ImageRunModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            command: this.props.image.Command ? utils.quote_cmdline(this.props.image.Command) : "sh",
            containerName: dockerNames.getRandomName(),
            env: [],
            hasTTY: true,
            publish: [],
            image: props.image,
            memory: 512,
            cpuShares: 1024,
            memoryConfigure: false,
            cpuSharesConfigure: false,
            memoryUnit: 'MiB',
            validationFailed: {},
            volumes: [],
            runImage: true,
            activeTabKey: 0,
        };
        this.getCreateConfig = this.getCreateConfig.bind(this);
        this.onCreateClicked = this.onCreateClicked.bind(this);
        this.onValueChanged = this.onValueChanged.bind(this);
    }

    getCreateConfig() {
        const createConfig = {};

        createConfig.image = this.state.image.RepoTags ? this.state.image.RepoTags[0] : "";
        if (this.state.containerName)
            createConfig.name = this.state.containerName;
        if (this.state.command) {
            createConfig.command = utils.unquote_cmdline(this.state.command);
        }
        const resourceLimit = {};
        if (this.state.memoryConfigure && this.state.memory) {
            const memorySize = this.state.memory * (1024 ** units[this.state.memoryUnit].base1024Exponent);
            resourceLimit.memory = { limit: memorySize };
            createConfig.resource_limits = resourceLimit;
        }
        if (this.state.cpuSharesConfigure && this.state.cpuShares !== 0) {
            resourceLimit.cpu = { shares: this.state.cpuShares };
            createConfig.resource_limits = resourceLimit;
        }
        createConfig.terminal = this.state.hasTTY;
        if (this.state.publish.length > 0)
            createConfig.portmappings = this.state.publish
                    .filter(port => port.containerPort)
                    .map(port => {
                        const pm = { container_port: parseInt(port.containerPort), protocol: port.protocol };
                        if (port.hostPort !== null)
                            pm.host_port = parseInt(port.hostPort);
                        if (port.IP !== null)
                            pm.host_ip = port.IP;
                        return pm;
                    });
        if (this.state.env.length > 0) {
            const ports = {};
            this.state.env.forEach(item => { ports[item.envKey] = item.envValue });
            createConfig.env = ports;
        }
        if (this.state.volumes.length > 0) {
            createConfig.mounts = this.state.volumes
                    .filter(volume => volume.hostPath && volume.containerPath)
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
    }

    onCreateClicked() {
        const createConfig = this.getCreateConfig();
        const { runImage } = this.state;

        client.createContainer(this.state.image.isSystem, createConfig)
                .then(reply => {
                    if (runImage) {
                        client.postContainer(this.state.image.isSystem, "start", reply.Id, {})
                                .then(() => this.props.close())
                                .catch(ex => {
                                    this.setState({
                                        dialogError: _("Container failed to be started"),
                                        dialogErrorDetail: cockpit.format("$0: $1", ex.reason, ex.message)
                                    });
                                });
                    } else {
                        this.props.close();
                    }
                })
                .catch(ex => {
                    this.setState({
                        dialogError: _("Container failed to be created"),
                        dialogErrorDetail: cockpit.format("$0: $1", ex.reason, ex.message)
                    });
                });
    }

    onValueChanged(key, value) {
        this.setState({ [key]: value });
    }

    handleTabClick = (event, tabIndex) => {
        // Prevent the form from being submitted.
        event.preventDefault();
        this.setState({
            activeTabKey: tabIndex,
        });
    };

    render() {
        const { image } = this.props;
        const dialogValues = this.state;
        const { activeTabKey } = this.state;

        // The Name field should be always horizontal regardless of the rest of the fields in the row
        // For this reason we need to explicitely add the pf-m-horizontal class to the Name field container
        // See design https://github.com/cockpit-project/cockpit/discussions/16059
        const defaultBody = (
            <Form isHorizontal={activeTabKey == 0}>
                <Flex>
                    <FlexItem className="pf-c-form pf-m-horizontal" align={{ default: 'alignLeft' }}>
                        <FormGroup fieldId='run-image-dialog-name' label={_("Name")}>
                            <TextInput id='run-image-dialog-name'
                               placeholder={_("Container name")}
                               value={dialogValues.containerName}
                               onChange={value => this.onValueChanged('containerName', value)} />
                        </FormGroup>
                    </FlexItem>
                </Flex>
                <Tabs activeKey={activeTabKey} onSelect={this.handleTabClick}>
                    <Tab eventKey={0} title={<TabTitleText>{_("Details")}</TabTitleText>} className="pf-l-grid pf-m-gutter">
                        <FormGroup fieldId='run-image-dialog-image' label={_("Image")} hasNoPaddingTop>
                            <div id='run-image-dialog-image'> { image.RepoTags ? image.RepoTags[0] : "" } </div>
                        </FormGroup>

                        <FormGroup fieldId='run-image-dialog-command' label={_("Command")}>
                            <TextInput id='run-image-dialog-command'
                           placeholder={_("Command")}
                           value={dialogValues.command || ''}
                           onChange={value => this.onValueChanged('command', value)} />
                        </FormGroup>

                        <FormGroup fieldId="run=image-dialog-tty">
                            <Checkbox id="run-image-dialog-tty"
                              isChecked={this.state.hasTTY}
                              label={_("With terminal")}
                              onChange={checked => this.onValueChanged('hasTTY', checked)} />
                        </FormGroup>

                        <FormGroup fieldId='run-image-dialog-memory' label={_("Memory limit")}>
                            <Flex alignItems={{ default: 'alignItemsCenter' }} className="ct-input-group-spacer-sm modal-run-limiter" id="run-image-dialog-memory-limit">
                                <Checkbox id="run-image-dialog-memory-limit-checkbox"
                                  isChecked={this.state.memoryConfigure}
                                  onChange={checked => this.onValueChanged('memoryConfigure', checked)} />
                                <TextInput type='number'
                                   value={dialogValues.memory}
                                   id="run-image-dialog-memory"
                                   className="dialog-run-form-input"
                                   step={1}
                                   min={0}
                                   isReadOnly={!this.state.memoryConfigure}
                                   onChange={value => this.onValueChanged('memory', value)} />
                                <FormSelect id='memory-unit-select'
                                    aria-label={_("Memory unit")}
                                    value={this.state.memoryUnit}
                                    isDisabled={!this.state.memoryConfigure}
                                    className="dialog-run-form-select"
                                    onChange={value => this.onValueChanged('memoryUnit', value)}>
                                    <FormSelectOption value={units.KiB.name} key={units.KiB.name} label={_("KiB")} />
                                    <FormSelectOption value={units.MiB.name} key={units.MiB.name} label={_("MiB")} />
                                    <FormSelectOption value={units.GiB.name} key={units.GiB.name} label={_("GiB")} />
                                </FormSelect>
                            </Flex>
                        </FormGroup>

                        { this.state.image.isSystem &&
                            <FormGroup fieldId='run-image-cpu-priority' label={_("CPU shares")}>
                                <Flex alignItems={{ default: 'alignItemsCenter' }} className="ct-input-group-spacer-sm modal-run-limiter" id="run-image-dialog-cpu-priority">
                                    <Checkbox id="run-image-dialog-cpu-priority-checkbox"
                                        isChecked={this.state.cpuSharesConfigure}
                                        onChange={checked => this.onValueChanged('cpuSharesConfigure', checked)} />
                                    <TextInput type='number'
                                        id="run-image-cpu-priority"
                                        value={dialogValues.cpuShares}
                                        step={1}
                                        min={2}
                                        max={262144}
                                        isReadOnly={!this.state.cpuSharesConfigure}
                                        onChange={value => this.onValueChanged('cpuShares', parseInt(value))} />
                                </Flex>
                            </FormGroup>}

                        <FormGroup fieldId='run-image-dialog-start-after-creation' label={_("Start after creation")} hasNoPaddingTop>
                            <Checkbox isChecked={this.state.runImage} id="run-image-dialog-start-after-creation" onChange={value => this.onValueChanged('runImage', value)} />
                        </FormGroup>
                    </Tab>
                    <Tab eventKey={1} title={<TabTitleText>{_("Integration")}</TabTitleText>} id="create-image-dialog-tab-integration" className="pf-c-form">

                        <DynamicListForm id='run-image-dialog-publish'
                                 emptyStateString={_("No ports exposed")}
                                 formclass='publish-port-form'
                                 label={_("Port mapping")}
                                 actionLabel={_("Add port mapping")}
                                 onChange={value => this.onValueChanged('publish', value)}
                                 default={{ IP: null, containerPort: null, hostPort: null, protocol: 'tcp' }}
                                 itemcomponent={ <PublishPort />} />

                        <DynamicListForm id='run-image-dialog-volume'
                                 emptyStateString={_("No volumes specified")}
                                 formclass='volume-form'
                                 label={_("Volumes")}
                                 actionLabel={_("Add volume")}
                                 onChange={value => this.onValueChanged('volumes', value)}
                                 default={{ containerPath: null, hostPath: null, mode: 'rw' }}
                                 options={{ selinuxAvailable: this.props.selinuxAvailable }}
                                 itemcomponent={ <Volume />} />

                        <DynamicListForm id='run-image-dialog-env'
                                 emptyStateString={_("No environment variables specified")}
                                 formclass='env-form'
                                 label={_("Environment variables")}
                                 actionLabel={_("Add variable")}
                                 onChange={value => this.onValueChanged('env', value)}
                                 default={{ envKey: null, envValue: null }}
                                 itemcomponent={ <EnvVar />} />
                    </Tab>
                </Tabs>
            </Form>
        );
        return (
            <Modal isOpen
                   position="top" variant="medium"
                   onClose={this.props.close}
                   title={_("Create container")}
                   footer={<>
                       {this.state.dialogError && <ErrorNotification errorMessage={this.state.dialogError} errorDetail={this.state.dialogErrorDetail} />}
                       <Button variant='primary' onClick={this.onCreateClicked}>
                           {_("Create")}
                       </Button>
                       <Button variant='link' className='btn-cancel' onClick={ this.props.close }>
                           {_("Cancel")}
                       </Button>
                   </>}
            >
                {defaultBody}
            </Modal>
        );
    }
}
