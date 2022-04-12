import React from 'react';
import PropTypes from 'prop-types';
import {
    Button,
    EmptyState, EmptyStateBody,
    Form, FormGroup, FormFieldGroup, FormFieldGroupHeader,
    HelperText, HelperTextItem,
    Modal, Radio,
    TextInput
} from '@patternfly/react-core';
import * as dockerNames from 'docker-names';

import { ErrorNotification } from './Notification.jsx';
import * as client from './client.js';
import cockpit from 'cockpit';

import "./VolumeCreateModal.scss";

const _ = cockpit.gettext;

const systemOwner = "system";

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
        const { id, label, actionLabel, formclass, emptyStateString, helperText } = this.props;
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
                        ? <>
                            {dialogValues.list.map((item, idx) => {
                                return React.cloneElement(this.props.itemcomponent, {
                                    idx: idx, item: item, id: id + "-" + idx,
                                    key: idx,
                                    onChange: this.onItemChange, removeitem: this.removeItem, additem: this.addItem, options: this.props.options,
                                    itemCount: Object.keys(dialogValues.list).length,
                                });
                            })
                            }
                            {helperText &&
                            <HelperText>
                                <HelperTextItem>{helperText}</HelperTextItem>
                            </HelperText>
                            }
                        </>
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

export class VolumeCreateModal extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            volumeName: dockerNames.getRandomName(),
            owner: this.props.systemServiceAvailable ? systemOwner : this.props.user,
        };
        this.getCreateConfig = this.getCreateConfig.bind(this);
        this.onValueChanged = this.onValueChanged.bind(this);
    }

    componentDidMount() {
        this._isMounted = true;
    }

    componentWillUnmount() {
        this._isMounted = false;

        if (this.activeConnection)
            this.activeConnection.close();
    }

    getCreateConfig() {
        const createConfig = {};

        if (this.state.volumeName) {
            createConfig.Name = this.state.volumeName;
        }

        return createConfig;
    }

    createVolume = (isSystem, createConfig) => {
        client.createVolume(isSystem, createConfig)
                .then(reply => {
                    this.props.close();
                })
                .catch(ex => {
                    this.setState({
                        dialogError: _("Volume failed to be created"),
                        dialogErrorDetail: cockpit.format("$0: $1", ex.reason, ex.message)
                    });
                });
    }

    async onCreateClicked() {
        const createConfig = this.getCreateConfig();
        const isSystem = this.isSystem();

        this.createVolume(isSystem, createConfig);
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

    handleOwnerSelect = (_, event) => {
        const value = event.currentTarget.value;
        this.setState({
            owner: value
        });
    }

    enablePodmanRestartService = () => {
        const argv = ["systemctl", "enable", "podman-restart.service"];

        cockpit.spawn(argv, { superuser: "require", err: "message" })
                .catch(err => {
                    console.warn("Failed to start podman-restart.service:", JSON.stringify(err));
                });
    }

    isSystem = () => {
        const { owner } = this.state;
        return owner === systemOwner;
    }

    render() {
        const dialogValues = this.state;
        const { owner } = this.state;

        const defaultBody = (
            <Form>
                <FormGroup fieldId='create-volume-dialog-name' label={_("Name")} className="ct-m-horizontal">
                    <TextInput id='create-volume-dialog-name'
                           className="volume-name"
                           placeholder={_("Volume name")}
                           value={dialogValues.volumeName}
                           onChange={value => this.onValueChanged('volumeName', value)} />
                </FormGroup>
                { this.props.userServiceAvailable && this.props.systemServiceAvailable &&
                <FormGroup isInline hasNoPaddingTop fieldId='create-container-dialog-owner' label={_("Owner")}>
                    <Radio value="system"
                            label={_("System")}
                            id="create-container-dialog-owner-system"
                            isChecked={owner === "system"}
                            onChange={this.handleOwnerSelect} />
                    <Radio value={this.props.user}
                            label={cockpit.format("$0 $1", _("User:"), this.props.user)}
                            id="create-container-dialog-owner-user"
                            isChecked={owner === this.props.user}
                            onChange={this.handleOwnerSelect} />
                </FormGroup>
                }
            </Form>
        );
        return (
            <Modal isOpen
                   position="top" variant="medium"
                   onClose={this.props.close}
                   onEscapePress={() => {
                       this.props.close();
                   }}
                   title={_("Create volume")}
                   footer={<>
                       {this.state.dialogError && <ErrorNotification errorMessage={this.state.dialogError} errorDetail={this.state.dialogErrorDetail} />}
                       <Button variant='primary' id="create-volume-create-btn" onClick={() => this.onCreateClicked(false)}>
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
