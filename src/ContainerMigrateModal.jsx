import React from 'react';
import {
    Button,
    Checkbox,
    Form,
    FormGroup,
    Modal,
    Radio,
    Select,
    SelectOption,
    TextInput,
    ValidatedOptions
} from '@patternfly/react-core';
import { ExclamationCircleIcon, InfoCircleIcon } from '@patternfly/react-icons';
import cockpit from 'cockpit';
import * as client from './client.js';

const _ = cockpit.gettext;

class ContainerMigrateModal extends React.Component {
    constructor(props) {
        super(props);
        this.strings = {
            targetHostPlaceholder: _("Choose target host..."),
            targetHostInaccessible: _("Connection failed"),
            targetContainerDefaultPlaceholder: _("Choose container..."),
            targetContainerLoadingPlaceholder: _("Loading container list..."),
            targetContainerErrorPlaceholder: _("Error loading container list"),
            targetContainerNameErrorEmpty: _("Container name can't be empty"),
            targetContainerNameErrorContainerExists: _("Container with that name already exists")
        };
        this.state = {
            action: "new-container",
            targetHost: this.strings.targetHostPlaceholder,
            targetHostValidated: ValidatedOptions.default,
            targetHostOpen: false,
            targetContainer: null,
            targetContainerList: [],
            targetContainerOpen: false,
            targetContainerName: "",
            targetContainerNameValidated: ValidatedOptions.default,
            targetContainerNameError: null,
            targetContainerPlaceholder: this.strings.targetContainerDefaultPlaceholder,
            keep: false,
            leaveRunning: false,
            tcpEstablished: false,
            ignoreRootFS: false,
            ignoreStaticIP: false,
            ignoreStaticMAC: false
        };
        this.handleChange = this.handleChange.bind(this);
        this.handleActionSelect = this.handleActionSelect.bind(this);
        this.handleTargetHostSelect = this.handleTargetHostSelect.bind(this);
        this.handleTargetContainerNameChange = this.handleTargetContainerNameChange.bind(this);
        this.handleTargetContainerSelect = this.handleTargetContainerSelect.bind(this);
        this.isTargetContainerDisabled = this.isTargetContainerDisabled.bind(this);
        this.isMigrateButtonDisabled = this.isMigrateButtonDisabled.bind(this);
        this.getContainerName = this.getContainerName.bind(this);
        this.updateTargetContainer = this.updateTargetContainer.bind(this);
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.props.remoteHosts !== prevProps.remoteHosts) {
            // On remote host list change, update target container element
            this.updateTargetContainer();
        }
    }

    handleChange(checked, event) {
        if (event.target.type === "checkbox")
            this.setState({ [event.target.name]: event.target.checked });
    }

    handleActionSelect(checked, event) {
        if (event.target.id === "migrate-dialog-action-new-container") {
            this.setState({
                action: "new-container"
            });
        } else if (event.target.id === "migrate-dialog-action-existing-container") {
            this.setState({
                action: "existing-container"
            });
        }
    }

    handleTargetHostSelect(event, targetHost) {
        this.setState({ targetHost, targetHostOpen: false });
        this.updateTargetContainer();
    }

    handleTargetContainerNameChange(targetContainerName) {
        this.setState(state => {
            const newState = { targetContainerName };

            if (state.targetHost === this.strings.targetHostPlaceholder) {
                newState.targetContainerNameValidated = ValidatedOptions.default;
                newState.targetContainerNameError = null;
            } else if (targetContainerName === "") {
                newState.targetContainerNameValidated = ValidatedOptions.error;
                newState.targetContainerNameError = this.strings.targetContainerNameErrorEmpty;
            } else {
                if (state.targetContainerList.includes(targetContainerName)) {
                    newState.targetContainerNameValidated = ValidatedOptions.error;
                    newState.targetContainerNameError = this.strings.targetContainerNameErrorContainerExists;
                } else {
                    newState.targetContainerNameValidated = ValidatedOptions.success;
                    newState.targetContainerNameError = null;
                }
            }

            return newState;
        });
    }

    handleTargetContainerSelect(event, targetContainer) {
        this.setState({ targetContainer, targetContainerOpen: false });
    }

    isTargetContainerDisabled() {
        return this.state.targetHost === this.strings.targetHostPlaceholder || this.state.targetContainerLoading ||
               this.props.migrateInProgress;
    }

    isMigrateButtonDisabled() {
        return this.props.migrateInProgress || this.state.targetHost === this.strings.targetHostPlaceholder ||
               this.state.targetContainerPlaceholder === this.strings.targetContainerErrorPlaceholder ||
               (this.state.action === "new-container" &&
                this.state.targetContainerNameValidated !== ValidatedOptions.success);
    }

    getContainerName() {
        if (this.state.targetContainer === this.strings.targetContainerErrorPlaceholder ||
            this.state.targetContainer === this.strings.targetContainerLoadingPlaceholder)
            return null;

        if (this.state.action === "new-container")
            return this.state.targetContainerName;

        return this.state.targetContainer;
    }

    updateTargetContainer() {
        let targetHost;

        if (Object.keys(this.props.remoteHosts).length === 1) {
            // Pre-select host if there is only one
            targetHost = Object.values(this.props.remoteHosts)[0];
        } else if (Object.keys(this.props.remoteHosts).length === 0 &&
                   this.state.targetHost !== this.strings.targetHostPlaceholder) {
            // There is no host - select the placeholder
            // Note: while the Select component automatically defaults to the placeholder in cases when an invalid
            // (i.e. removed) host is selected, this is not reflected in the modal state, therefore it has to be handled
            // explicitly here.
            targetHost = this.strings.targetHostPlaceholder;
        } else {
            targetHost = this.state.targetHost;
        }

        if (targetHost !== this.strings.targetHostPlaceholder) {
            // Update target container list based on the host
            this.setState({
                targetHost,
                targetContainerPlaceholder: this.strings.targetContainerLoadingPlaceholder,
                targetContainerList: []
            });
            const modal = this;
            client.getContainers(true, undefined, targetHost)
                    .then(function (containers) {
                        const newContainerList = [];
                        for (const container of containers)
                            newContainerList.push(container.Names[0]);
                        modal.setState({
                            targetHostValidated: ValidatedOptions.default,
                            targetContainerPlaceholder: modal.strings.targetContainerDefaultPlaceholder,
                            targetContainer: newContainerList.length === 1 ? newContainerList[0]
                                : modal.strings.targetContainerPlaceholder,
                            targetContainerList: newContainerList
                        });

                        // Update target container name field
                        modal.handleTargetContainerNameChange(modal.state.targetContainerName);
                    })
                    .catch(function(error) {
                        console.warn(`Couldn't connect to remote host: ${JSON.stringify(error)}`);
                        modal.setState({
                            targetHostValidated: ValidatedOptions.error,
                            targetContainerPlaceholder: modal.strings.targetContainerErrorPlaceholder,
                            targetContainer: modal.strings.targetContainerError,
                            targetContainerList: []
                        });
                    });
        } else {
            this.setState({
                targetHost,
                targetHostValidated: ValidatedOptions.default,
                targetContainer: this.strings.targetContainerDefaultPlaceholder,
                targetContainerList: [],
                targetContainerLoading: false,
                targetContainerError: false
            });

            // Update target container name field
            this.handleTargetContainerNameChange(this.state.targetContainerName);
        }
    }

    render() {
        return (
            <Modal isOpen={this.props.selectContainerMigrateModal}
                   showClose={false}
                   position="top" variant="medium"
                   onClose={this.props.handleMigrateContainerDeleteModal}
                   title={_(`Migrate container ${this.props.containerWillMigrate.Names} to another host`)}
                   footer={<>
                       <Button variant="primary" isDisabled={this.isMigrateButtonDisabled()}
                               isLoading={this.props.migrateInProgress}
                               onClick={() => this.props.handleMigrateContainer(this.state, this.state.targetHost,
                                                                                this.getContainerName())}>
                           {_("Migrate")}
                       </Button>
                       <Button variant="link" isDisabled={this.props.migrateInProgress}
                               onClick={this.props.handleMigrateContainerDeleteModal}>
                           {_("Cancel")}
                       </Button>
                       <label className="migration-progress">
                           {this.props.migrationStateLabel}
                       </label>
                   </>}
            >
                <Form isHorizontal>
                    <FormGroup id="migrate-dialog-action" label={_("Action")} isInline>
                        <Radio id="migrate-dialog-action-new-container" isDisabled={this.props.migrateInProgress}
                               isChecked={this.state.action === "new-container"} name="action"
                               onChange={this.handleActionSelect} label={_("Create new container")} />
                        <Radio id="migrate-dialog-action-existing-container" isDisabled={this.props.migrateInProgress}
                               isChecked={this.state.action === "existing-container"} name="action"
                               onChange={this.handleActionSelect} label={_("Restore into existing container")} />
                    </FormGroup>

                    <FormGroup id="migrate-dialog-target-host-form-group" validated={this.state.targetHostValidated}
                               label={_("Target host")}
                               helperText={_("Add destination hosts using the host selector")}
                               helperTextIcon={<InfoCircleIcon />}
                               helperTextInvalid={this.strings.targetHostInaccessible}
                               helperTextInvalidIcon={<ExclamationCircleIcon />}>
                        <Select id="migrate-dialog-target-host" isOpen={this.state.targetHostOpen}
                                isDisabled={this.props.migrateInProgress}
                                placeholderText={this.strings.targetHostPlaceholder}
                                selections={this.state.targetHost}
                                onToggle={targetHostOpen => this.setState({ targetHostOpen })}
                                onSelect={this.handleTargetHostSelect}>
                            {
                                Object.keys(this.props.remoteHosts).map(host =>
                                    <SelectOption value={this.props.remoteHosts[host]} key={host} />)
                            }
                        </Select>
                    </FormGroup>

                    <FormGroup id="migrate-dialog-target" label={_("Target container")}
                               validated={this.state.action === "new-container"
                                   ? this.state.targetContainerNameValidated
                                   : ValidatedOptions.default}
                               helperTextInvalid={this.state.targetContainerNameError}
                               helperTextInvalidIcon={<ExclamationCircleIcon />}>
                        {this.state.action === "new-container"
                            ? <TextInput id="migrate-container-target-name" value={this.state.targetContainerName}
                                           onChange={this.handleTargetContainerNameChange}
                                           validated={this.state.targetContainerNameValidated} />
                            : <Select id="migrate-dialog-target-container"
                                                   isOpen={this.state.targetContainerOpen}
                                                   placeholderText={this.state.targetContainerPlaceholder}
                                                   selections={this.state.targetContainer}
                                                   isDisabled={this.isTargetContainerDisabled()}
                                                   onToggle={targetContainerOpen =>
                                                       this.setState({ targetContainerOpen })}
                                                   onSelect={this.handleTargetContainerSelect}>
                                {
                                    this.state.targetContainerList.map(container => <SelectOption value={container}
                                                                                                  key={container} />)
                                }
                            </Select>}
                    </FormGroup>

                    <FormGroup id="migrate-dialog-options" label={_("Options")}>
                        <Checkbox id="migrate-dialog-keep" name="keep" isChecked={this.state.keep}
                                  label={_("Keep all temporary checkpoint files")}
                                  isDisabled={this.props.migrateInProgress} onChange={this.handleChange} />
                        <Checkbox id="migrate-dialog-leaveRunning" name="leaveRunning"
                                  label={_("Leave running after migration")}
                                  isChecked={this.state.leaveRunning} isDisabled={this.props.migrateInProgress}
                                  onChange={this.handleChange} />
                        <Checkbox id="migrate-dialog-tcpEstablished" name="tcpEstablished"
                                  label={_("Preserve established TCP connections")}
                                  isChecked={this.state.tcpEstablished} isDisabled={this.props.migrateInProgress}
                                  onChange={this.handleChange} />
                        <Checkbox id="migrate-dialog-ignoreRootFS" name="ignoreRootFS"
                                  label={_("Do not migrate root file-system changes")}
                                  isChecked={this.state.ignoreRootFS} isDisabled={this.props.migrateInProgress}
                                  onChange={this.handleChange} />
                        <Checkbox id="migrate-dialog-ignoreStaticIP" name="ignoreStaticIP"
                                  label={_("Ignore IP address if set statically")}
                                  isChecked={this.state.ignoreStaticIP} isDisabled={this.props.migrateInProgress}
                                  onChange={this.handleChange} />
                        <Checkbox id="migrate-dialog-ignoreStaticMAC" name="ignoreStaticMAC"
                                  label={_("Ignore MAC address if set statically")}
                                  isChecked={this.state.ignoreStaticMAC} isDisabled={this.props.migrateInProgress}
                                  onChange={this.handleChange} />
                    </FormGroup>
                </Form>
            </Modal>
        );
    }
}

export default ContainerMigrateModal;
