import React from 'react';
import PropTypes from 'prop-types';
import { Button, Checkbox, Form, FormGroup, InputGroup, Modal, TextInput } from '@patternfly/react-core';
import { CloseIcon, PlusIcon } from '@patternfly/react-icons';
import * as dockerNames from 'docker-names';

import * as Select from '../lib/cockpit-components-select.jsx';
import { ErrorNotification } from './Notification.jsx';
import { FileAutoComplete } from '../lib/cockpit-components-file-autocomplete.jsx';
import * as utils from './util.js';
import * as client from './client.js';
import cockpit from 'cockpit';

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

const PublishPort = ({ id, item, onChange, idx, removeitem, additem }) =>
    (
        <>
            <InputGroup className='ct-input-group-spacer-sm' id={id}>
                <TextInput aria-label={_("IP (optional)")}
                           type='text'
                           placeholder={_("IP (optional)")}
                           value={item.IP || ''}
                           onChange={value => onChange(idx, 'IP', value)} />
                <TextInput aria-label={_("Host port (optional)")}
                           type='number'
                           step={1}
                           min={1}
                           max={65535}
                           placeholder={_("Host port (optional)")}
                           value={item.hostPort || ''}
                           onChange={value => onChange(idx, 'hostPort', value)} />
                <TextInput aria-label={_("Container port")}
                           type='number'
                           step={1}
                           min={1}
                           max={65535}
                           placeholder={_("Container port")}
                           value={item.containerPort || ''}
                           onChange={value => onChange(idx, 'containerPort', value)} />
                <Select.Select extraClass='pf-c-form-control container-port-protocol'
                               initial={item.protocol}
                               onChange={value => onChange(idx, 'protocol', value)}>
                    <Select.SelectEntry data='tcp' key='tcp'>
                        {_("TCP")}
                    </Select.SelectEntry>
                    <Select.SelectEntry data='udp' key='udp'>
                        {_("UDP")}
                    </Select.SelectEntry>
                </Select.Select>
                <Button variant='secondary'
                        className={"btn-close" + (idx === 0 && !item.IP && !item.hostPort && !item.containerPort ? ' invisible' : '')}
                        isSmall
                        aria-label={_("Remove item")}
                        icon={<CloseIcon />}
                        onClick={() => removeitem(idx)} />
                <Button variant='secondary' className="btn-add" onClick={additem} aria-label={_("Add item")} icon={<PlusIcon />} />
            </InputGroup>
        </>
    );

const EnvVar = ({ id, item, onChange, idx, removeitem, additem }) =>
    (
        <>
            <InputGroup className="ct-input-group-spacer-sm" id={id}>
                <TextInput aria-label={_("Key")}
                           type='text'
                           placeholder={_("Key")}
                           value={item.envKey || ''}
                           onChange={value => onChange(idx, 'envKey', value)} />
                <TextInput aria-label={_("Value")}
                           type='text'
                           placeholder={_("Value")}
                           value={item.envValue || ''}
                           onChange={value => onChange(idx, 'envValue', value)} />
                <Button variant='secondary'
                        className={"btn-close" + (idx === 0 && !item.envKey && !item.envValue ? ' invisible' : '')}
                        isSmall
                        aria-label={_("Remove item")}
                        icon={<CloseIcon />}
                        onClick={() => removeitem(idx)} />
                <Button variant='secondary'
                    className="btn-add"
                    onClick={additem}
                    icon={<PlusIcon />}
                    aria-label={_("Add item")} />
            </InputGroup>
        </>
    );

const Volume = ({ id, item, onChange, idx, removeitem, additem, options }) =>
    (
        <>
            <InputGroup className='ct-input-group-spacer-sm' id={id || ''}>
                <FileAutoComplete aria-label={_("Host path")}
                                  placeholder={_("Host path")}
                                  value={item.hostPath || ''}
                                  onChange={ value => onChange(idx, 'hostPath', value) } />
                <TextInput aria-label={_("Container path")}
                           placeholder={_("Container path")}
                           value={item.containerPath || ''}
                           onChange={value => onChange(idx, 'containerPath', value)} />

                <Button variant='secondary'
                        className={"btn-close" + (idx === 0 && !item.containerPath && !item.hostPath ? ' invisible' : '')}
                        aria-label={_("Remove item")}
                        isSmall
                        icon={<CloseIcon />}
                        onClick={() => removeitem(idx)} />
                <Button variant='secondary'
                        className="btn-add"
                        onClick={additem}
                        isSmall
                        icon={<PlusIcon />}
                        aria-label={_("Add item")} />
            </InputGroup>
            <InputGroup className='ct-input-group-spacer-sm'>
                <Select.Select extraClass='pf-c-form-control'
                               initial={item.mode}
                               onChange={value => onChange(idx, 'mode', value)}>
                    <Select.SelectEntry data='ro' key='ro'>
                        {_("ReadOnly")}
                    </Select.SelectEntry>
                    <Select.SelectEntry data='rw' key='rw'>
                        {_("ReadWrite")}
                    </Select.SelectEntry>
                </Select.Select>
                { options && options.selinuxAvailable &&
                    <Select.Select extraClass='pf-c-form-control'
                                   initial={item.mode}
                                   onChange={value => onChange(idx, 'selinux', value)}>
                        <Select.SelectEntry data='' key=''>
                            {_("No SELinux label")}
                        </Select.SelectEntry>
                        <Select.SelectEntry data='z' key='z'>
                            {_("Shared")}
                        </Select.SelectEntry>
                        <Select.SelectEntry data='Z' key='Z'>
                            {_("Private")}
                        </Select.SelectEntry>
                    </Select.Select>
                }
            </InputGroup>
        </>
    );

class DynamicListForm extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            list: [Object.assign({ key: 0 }, props.default)],
        };
        this.keyCounter = 1;
        this.removeItem = this.removeItem.bind(this);
        this.addItem = this.addItem.bind(this);
        this.onItemChange = this.onItemChange.bind(this);
    }

    removeItem(idx, field, value) {
        this.setState(state => {
            const items = state.list.concat();
            items.splice(idx, 1);
            if (items.length === 0)
                items.push(Object.assign({ key: this.keyCounter++ }, this.props.default));
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
        const { id, formclass } = this.props;
        const dialogValues = this.state;
        return (
            <>
                {
                    dialogValues.list.map((item, idx) =>
                        (

                            <div className={formclass || ''} key={ item.key } data-key={ item.key }>
                                {
                                    React.cloneElement(this.props.itemcomponent, {
                                        idx: idx, item: item, id: (idx === 0 && id) || undefined,
                                        onChange: this.onItemChange, removeitem: this.removeItem, additem: this.addItem, options: this.props.options,
                                    })
                                }
                            </div>
                        )
                    )
                }
            </>
        );
    }
}
DynamicListForm.propTypes = {
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
            cpuShares: "",
            memoryConfigure: false,
            cpuSharesConfigure: false,
            memoryUnit: 'MiB',
            validationFailed: {},
            volumes: [],
        };
        this.getCreateConfig = this.getCreateConfig.bind(this);
        this.onRunClicked = this.onRunClicked.bind(this);
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
        if (this.state.cpuSharesConfigure && this.state.cpuShares !== "") {
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

    onRunClicked() {
        const createConfig = this.getCreateConfig();

        client.createContainer(this.state.image.isSystem, createConfig)
                .then(reply => {
                    client.postContainer(this.state.image.isSystem, "start", reply.Id, {})
                            .then(() => this.props.close())
                            .catch(ex => {
                                this.setState({
                                    dialogError: _("Container failed to be started"),
                                    dialogErrorDetail: cockpit.format("$0: $1", ex.reason, ex.message)
                                });
                            });
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

    render() {
        const { image } = this.props;
        const dialogValues = this.state;

        const defaultBody = (
            <Form isHorizontal>
                <FormGroup fieldId='run-image-dialog-image' label={_("Image")} hasNoPaddingTop>
                    <div id='run-image-dialog-image'> { image.RepoTags ? image.RepoTags[0] : "" } </div>
                </FormGroup>

                <FormGroup fieldId='run-image-dialog-name' label={_("Name")}>
                    <TextInput id='run-image-dialog-name'
                               placeholder={_("Container name")}
                               value={dialogValues.containerName}
                               onChange={value => this.onValueChanged('containerName', value)} />
                </FormGroup>

                <FormGroup fieldId='run-image-dialog-command' label={_("Command")}>
                    <TextInput id='run-image-dialog-command'
                               placeholder={_("Command")}
                               value={dialogValues.command || ''}
                               onChange={value => this.onValueChanged('command', value)} />
                </FormGroup>

                <FormGroup fieldId='run-image-dialog-memory' label={_("Memory limit")}>
                    <InputGroup className="ct-input-group-spacer-sm" id="run-image-dialog-memory-limit">
                        <Checkbox id="run-image-dialog-memory-limit-checkbox"
                                  isChecked={this.state.memoryConfigure}
                                  onChange={checked => this.onValueChanged('memoryConfigure', checked)} />
                        <TextInput type='number'
                                   value={dialogValues.memory}
                                   id="run-image-dialog-memory"
                                   step={1}
                                   min={0}
                                   isReadOnly={!this.state.memoryConfigure}
                                   onChange={value => this.onValueChanged('memory', value)} />
                        <Select.Select id='memory-unit-select'
                                       initial={this.state.memoryUnit}
                                       enabled={this.state.memoryConfigure}
                                       onChange={value => this.onValueChanged('memoryUnit', value)}>
                            <Select.SelectEntry data={units.KiB.name} key={units.KiB.name}>
                                {_("KiB")}
                            </Select.SelectEntry>
                            <Select.SelectEntry data={units.MiB.name} key={units.MiB.name}>
                                {_("MiB")}
                            </Select.SelectEntry>
                            <Select.SelectEntry data={units.GiB.name} key={units.GiB.name}>
                                {_("GiB")}
                            </Select.SelectEntry>
                        </Select.Select>
                    </InputGroup>
                </FormGroup>

                { this.state.image.isSystem &&
                <FormGroup fieldId='run-image-cpu-priority' label={_("CPU shares")}>
                    <InputGroup className="ct-input-group-spacer-sm" id="run-image-dialog-cpu-priority">
                        <Checkbox id="run-image-dialog-cpu-priority-checkbox"
                                  isChecked={this.state.cpuSharesConfigure}
                                  onChange={checked => this.onValueChanged('cpuSharesConfigure', checked)} />
                        <TextInput type='number'
                                   id="run-image-cpu-priority"
                                   value={dialogValues.cpuShares}
                                   step={1}
                                   min={2}
                                   isReadOnly={!this.state.cpuSharesConfigure}
                                   onChange={value => this.onValueChanged('cpuShares', value === "" ? "" : parseInt(value))} />
                    </InputGroup>
                </FormGroup>}

                <FormGroup fieldId="run=image-dialog-tty">
                    <Checkbox id="run-image-dialog-tty"
                              isChecked={this.state.hasTTY}
                              label={_("With terminal")}
                              onChange={checked => this.onValueChanged('hasTTY', checked)} />
                </FormGroup>

                <FormGroup fieldId='run-image-dialog-publish' label={_("Ports")}>
                    <DynamicListForm id='run-image-dialog-publish'
                                     formclass='publish-port-form'
                                     onChange={value => this.onValueChanged('publish', value)}
                                     default={{ IP: null, containerPort: null, hostPort: null, protocol: 'tcp' }}
                                     itemcomponent={ <PublishPort />} />
                </FormGroup>

                <FormGroup fieldId='run-image-dialog-env' label={_("Volumes")}>
                    <DynamicListForm id='run-image-dialog-volume'
                                     formclass='volume-form'
                                     onChange={value => this.onValueChanged('volumes', value)}
                                     default={{ containerPath: null, hostPath: null, mode: 'rw' }}
                                     options={{ selinuxAvailable: this.props.selinuxAvailable }}
                                     itemcomponent={ <Volume />} />
                </FormGroup>

                <FormGroup fieldId='run-image-dialog-env' label={_("Environment")}>
                    <DynamicListForm id='run-image-dialog-env'
                                     formclass='env-form'
                                     onChange={value => this.onValueChanged('env', value)}
                                     default={{ envKey: null, envValue: null }}
                                     itemcomponent={ <EnvVar />} />
                </FormGroup>
            </Form>
        );
        return (
            <Modal isOpen
                   position="top" variant="medium"
                   onClose={this.props.close}
                   title={_("Run image")}
                   footer={<>
                       {this.state.dialogError && <ErrorNotification errorMessage={this.state.dialogError} errorDetail={this.state.dialogErrorDetail} />}
                       <Button variant='primary' onClick={this.onRunClicked}>
                           {_("Run")}
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
