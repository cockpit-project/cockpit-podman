import React from 'react';
import { Button, Modal } from 'patternfly-react';
import * as dockerNames from 'docker-names';

import * as Select from '../lib/cockpit-components-select.jsx';
import { ErrorNotification } from './Notification.jsx';
import * as utils from './util.js';
import varlink from './varlink.js';
import cockpit from 'cockpit';

import '../lib/form-layout.less';

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

export class ImageRunModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            command: 'sh',
            containerName: dockerNames.getRandomName(),
            hasTTY: true,
            image: props.image,
            memory: 512,
            memoryConfigure: false,
            memoryUnit: 'MiB',
            validationFailed: {},
        };
        this.getCreateConfig = this.getCreateConfig.bind(this);
        this.onRunClicked = this.onRunClicked.bind(this);
        this.onValueChanged = this.onValueChanged.bind(this);
    }

    getCreateConfig() {
        let props = {};

        props.image = this.state.image.repoTags ? this.state.image.repoTags[0] : "";
        props.resources = {};
        if (this.state.containerName)
            props.name = this.state.containerName;
        if (this.state.command)
            props.command = [this.state.command];
        if (this.state.memoryConfigure && this.state.memory)
            props.resources.memory = this.state.memory * (1024 ** units[this.state.memoryUnit].base1024Exponent);
        if (this.state.hasTTY)
            props.tty = true;

        return props;
    }

    onRunClicked() {
        const createConfig = this.getCreateConfig();

        varlink.call(utils.PODMAN_ADDRESS, "io.podman.CreateContainer", { create: createConfig })
                .then(reply => varlink.call(utils.PODMAN_ADDRESS, "io.podman.StartContainer", { name: reply.container }))
                .then(() => {
                    this.props.close();
                    return this.props.updateContainersAfterEvent();
                })
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

        let defaultBody = (
            <div className='ct-form-layout'>
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
                <div role='group' className='form-inline'>
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

                <label className='control-label'> {_("With terminal")} </label>
                <label className="checkbox-inline">
                    <input id="run-image-dialog-tty" type="checkbox"
                           checked={this.state.hasTTY}
                           onChange={e => this.onValueChanged('hasTTY', e.target.checked)} />
                </label>
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
                    <Button bsStyle='default' className='btn-cancel' onClick={ this.props.close }>
                        {_("Cancel")}
                    </Button>
                    <Button bsStyle='primary' onClick={this.onRunClicked}>
                        {_("Run")}
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}
