import React from 'react';
import PropTypes from 'prop-types';
import { Modal } from 'patternfly-react';
import { Button } from '@patternfly/react-core';
import * as dockerNames from 'docker-names';

import * as Select from '../lib/cockpit-components-select.jsx';
import { ErrorNotification } from './Notification.jsx';
import { FileAutoComplete } from '../lib/cockpit-components-file-autocomplete.jsx';
import * as utils from './util.js';
import cockpit from 'cockpit';

import '../lib/form-layout.scss';

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
            <div role='group' className='ct-form-split'>
                <input className='form-control'
                       id={id}
                       type='number'
                       step={1}
                       min={1}
                       max={65535}
                       placeholder={_("Container port")}
                       value={item.containerPort || ''}
                       onChange={e => onChange(idx, 'containerPort', e.target.value)} />
                <input className='form-control'
                       type='number'
                       step={1}
                       min={1}
                       max={65535}
                       placeholder={_("Host port")}
                       value={item.hostPort || ''}
                       onChange={e => onChange(idx, 'hostPort', e.target.value)} />
                <Select.Select className='form-control'
                               initial={item.protocol}
                               onChange={value => onChange(idx, 'protocol', value)}>
                    <Select.SelectEntry data='TCP' key='TCP'>
                        {_("TCP")}
                    </Select.SelectEntry>
                    <Select.SelectEntry data='UDP' key='UDP'>
                        {_("UDP")}
                    </Select.SelectEntry>
                </Select.Select>
            </div>
            <div role='group' className='ct-form-split run-image-dialog-actions'>
                <Button variant='secondary'
                        className={"btn-close" + (idx === 0 && !item.hostPort && !item.containerPort ? ' invisible' : '')}
                        aria-label={_("Remove item")}
                        onClick={() => removeitem(idx)}>
                    <span className="pficon pficon-close" />
                </Button>
                <Button variant='secondary' className="btn-add" onClick={additem} aria-label={_("Add item")}>
                    <span className='fa fa-plus' />
                </Button>
            </div>
        </>
    );

const EnvVar = ({ id, item, onChange, idx, removeitem, additem }) =>
    (
        <>
            <div role='group' className='ct-form-split'>
                <input className='form-control'
                       id={id}
                       type='text'
                       placeholder={_("Key")}
                       value={item.envKey || ''}
                       onChange={e => onChange(idx, 'envKey', e.target.value)} />
                <input className='form-control'
                       type='text'
                       placeholder={_("Value")}
                       value={item.envValue || ''}
                       onChange={e => onChange(idx, 'envValue', e.target.value)} />
            </div>
            <div role='group' className='ct-form-split run-image-dialog-actions'>
                <Button variant='secondary'
                        className={"btn-close" + (idx === 0 && !item.envKey && !item.envValue ? ' invisible' : '')}
                        aria-label={_("Remove item")}
                        onClick={() => removeitem(idx)}>
                    <span className="pficon pficon-close" />
                </Button>
                <Button variant='secondary' className="btn-add" onClick={additem} aria-label={_("Add item")}>
                    <span className='fa fa-plus' />
                </Button>
            </div>
        </>
    );

const Volume = ({ id, item, onChange, idx, removeitem, additem }) =>
    (
        <>
            <div role='group' className='ct-form-split'>
                <FileAutoComplete id={id || ''}
                                  placeholder={_("Host path")}
                                  value={item.hostPath || ''}
                                  onChange={ value => onChange(idx, 'hostPath', value) } />
                <input className='form-control ct-form-relax'
                       type='text'
                       placeholder={_("Container path")}
                       value={item.containerPath || ''}
                       onChange={e => onChange(idx, 'containerPath', e.target.value)} />
                <Select.Select className='form-control'
                               initial={item.mode}
                               onChange={value => onChange(idx, 'mode', value)}>
                    <Select.SelectEntry data='ro' key='ro'>
                        {_("ReadOnly")}
                    </Select.SelectEntry>
                    <Select.SelectEntry data='rw' key='rw'>
                        {_("ReadWrite")}
                    </Select.SelectEntry>
                </Select.Select>
            </div>
            <div role='group' className='ct-form-split run-image-dialog-actions'>
                <Button variant='secondary'
                        className={"btn-close" + (idx === 0 && !item.containerPath && !item.hostPath ? ' invisible' : '')}
                        aria-label={_("Remove item")}
                        onClick={() => removeitem(idx)}>
                    <span className="pficon pficon-close" />
                </Button>
                <Button variant='secondary' className="btn-add" onClick={additem} aria-label={_("Add item")}>
                    <span className='fa fa-plus' />
                </Button>
            </div>
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

                            <div className={ (formclass || '') + ' ct-form form-list-control' } key={ item.key } data-key={ item.key }>
                                {
                                    React.cloneElement(this.props.itemcomponent, {
                                        idx: idx, item: item, id: (idx === 0 && id) || undefined,
                                        onChange: this.onItemChange, removeitem: this.removeItem, additem: this.addItem
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
};

export class ImageRunModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            command: this.props.image.command ? utils.quote_cmdline(this.props.image.command) : "sh",
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

        createConfig.args = this.state.image.repoTags ? [this.state.image.repoTags[0]] : [""];
        if (this.state.containerName)
            createConfig.name = this.state.containerName;
        if (this.state.command) {
            createConfig.args = createConfig.args.concat(utils.unquote_cmdline(this.state.command));
        }
        if (this.state.memoryConfigure && this.state.memory) {
            const memorySize = this.state.memory * (1024 ** units[this.state.memoryUnit].base1024Exponent);
            createConfig.memory = memorySize.toString();
        }
        if (this.state.cpuSharesConfigure && this.state.cpuShares !== "") {
            createConfig.cpuShares = this.state.cpuShares;
        }
        if (this.state.hasTTY)
            createConfig.tty = true;
        if (this.state.publish.length > 0)
            createConfig.publish = this.state.publish
                    .filter(port => port.hostPort && port.containerPort)
                    .map(port => port.hostPort + ':' + port.containerPort + '/' + port.protocol);
        if (this.state.env.length > 0) {
            createConfig.env = this.state.env.map(item => item.envKey + "=" + item.envValue);
        }
        if (this.state.volumes.length > 0) {
            createConfig.volume = this.state.volumes
                    .filter(volume => volume.hostPath && volume.containerPath)
                    .map(volume => {
                        if (volume.mode)
                            return volume.hostPath + ':' + volume.containerPath + ':' + volume.mode;
                        return volume.hostPath + ':' + volume.containerPath;
                    });
        }

        return createConfig;
    }

    onRunClicked() {
        const createConfig = this.getCreateConfig();

        utils.podmanCall("CreateContainer", { create: createConfig }, this.state.image.isSystem)
                .then(reply => utils.podmanCall("StartContainer", { name: reply.container }, this.state.image.isSystem))
                .then(() => this.props.close())
                .catch(ex => {
                    this.setState({
                        dialogError: _("Container failed to be created"),
                        dialogErrorDetail: cockpit.format("$0: $1", ex.error, ex.parameters && ex.parameters.reason)
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
            <div className='ct-form'>
                <label className='control-label' htmlFor='run-image-dialog-image'>
                    {_("Image")}
                </label>
                <div id='run-image-dialog-image'> { image.repoTags ? image.repoTags[0] : "" } </div>

                <label className='control-label' htmlFor='run-image-dialog-name'>
                    {_("Name")}
                </label>
                <input id='run-image-dialog-name'
                    type='text'
                    placeholder={_("Container Name")}
                    value={dialogValues.containerName}
                    onChange={e => this.onValueChanged('containerName', e.target.value)}
                    className='form-control' />

                <hr />
                <label className='control-label' htmlFor='run-image-dialog-command'>
                    {_("Command")}
                </label>
                <input id='run-image-dialog-command'
                    type='text'
                    placeholder={_("Command")}
                    value={dialogValues.command || ''}
                    onChange={e => this.onValueChanged('command', e.target.value)}
                    className='form-control' />

                <label className='control-label' htmlFor='run-image-dialog-memory'>
                    {_("Memory Limit")}
                </label>
                <div role='group' className='form-inline' id="run-image-dialog-memory-limit">
                    <div className="checkbox">
                        <input id="run-image-dialog-memory-limit-checkbox" type="checkbox"
                               checked={this.state.memoryConfigure}
                               onChange={e => this.onValueChanged('memoryConfigure', e.target.checked)} />
                    </div>
                    <input className='form-control'
                           type='number'
                           value={dialogValues.memory}
                           step={1}
                           min={0}
                           disabled={!this.state.memoryConfigure}
                           onChange={e => this.onValueChanged('memory', e.target.value)} />
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
                </div>

                { this.state.image.isSystem &&
                    <>
                        <label className='control-label' htmlFor='run-image-cpu-priority'>
                            {_("CPU Shares")}
                        </label>
                        <div role='group' className='form-inline' id="run-image-dialog-cpu-priority">
                            <div className="checkbox">
                                <input id="run-image-dialog-cpu-priority-checkbox" type="checkbox"
                                       checked={this.state.cpuSharesConfigure}
                                       onChange={e => this.onValueChanged('cpuSharesConfigure', e.target.checked)} />
                            </div>
                            <input className='form-control'
                                   type='number'
                                   value={dialogValues.cpuShares}
                                   step={1}
                                   min={2}
                                   disabled={!this.state.cpuSharesConfigure}
                                   onChange={e => this.onValueChanged('cpuShares', e.target.value === "" ? "" : parseInt(e.target.value))} />
                        </div>
                    </>
                }

                <label className='control-label'> {_("With terminal")} </label>
                <label className="checkbox-inline">
                    <input id="run-image-dialog-tty" type="checkbox"
                           checked={this.state.hasTTY}
                           onChange={e => this.onValueChanged('hasTTY', e.target.checked)} />
                </label>

                <hr />
                <label className='control-label' htmlFor='run-image-dialog-publish'>{ _("Ports") }</label>
                <DynamicListForm id='run-image-dialog-publish'
                                 formclass='publish-port-form'
                                 onChange={value => this.onValueChanged('publish', value)}
                                 default={{ containerPort: null, hostPort: null, protocol: 'TCP' }}
                                 itemcomponent={ <PublishPort />} />

                <hr />
                <label className='control-label' htmlFor='run-image-dialog-env'>{ _("Volumes") }</label>
                <DynamicListForm id='run-image-dialog-volume'
                                 formclass='volume-form'
                                 onChange={value => this.onValueChanged('volumes', value)}
                                 default={{ containerPath: null, hostPath: null, mode: 'rw' }}
                                 itemcomponent={ <Volume />} />

                <hr />
                <label className='control-label' htmlFor='run-image-dialog-env'>{ _("Environment") }</label>
                <DynamicListForm id='run-image-dialog-env'
                                 formclass='env-form'
                                 onChange={value => this.onValueChanged('env', value)}
                                 default={{ envKey: null, envValue: null }}
                                 itemcomponent={ <EnvVar />} />
            </div>
        );
        return (
            <Modal show onHide={this.props.close}>
                <Modal.Header>
                    <Modal.CloseButton onClick={this.props.close} />
                    <Modal.Title> {_("Run Image")} </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {defaultBody}
                </Modal.Body>
                <Modal.Footer>
                    {this.state.dialogError && <ErrorNotification errorMessage={this.state.dialogError} errorDetail={this.state.dialogErrorDetail} />}
                    <Button variant='primary' onClick={this.onRunClicked}>
                        {_("Run")}
                    </Button>
                    <Button variant='link' className='btn-cancel' onClick={ this.props.close }>
                        {_("Cancel")}
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}
