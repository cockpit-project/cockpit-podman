import React from 'react';
import { Button, Checkbox, Modal, Select, SelectOption, TextInput } from '@patternfly/react-core';
import cockpit from 'cockpit';
import * as client from './client.js';

const _ = cockpit.gettext;

class ContainerMigrateModal extends React.Component {
    constructor(props) {
        super(props);
        this.targetHostPlaceholder = _("Choose target host...");
        this.targetContainerPlaceholder = _("Create new container");
        this.targetContainerLoading = _("Loading container list...");
        this.targetContainerError = _("Error loading container list");
        this.state = {
            targetHost: this.targetHostPlaceholder,
            targetHostOpen: false,
            targetContainer: this.targetContainerPlaceholder,
            targetContainerList: [],
            targetContainerOpen: false,
            targetContainerLoading: false,
            targetContainerError: false,
            targetContainerName: "",
            keep: false,
            leaveRunning: false,
            tcpEstablished: false,
            ignoreRootFS: false
        };
        this.handleChange = this.handleChange.bind(this);
        this.handleTargetHostSelect = this.handleTargetHostSelect.bind(this);
        this.handleTargetContainerSelect = this.handleTargetContainerSelect.bind(this);
        this.isTargetContainerDisabled = this.isTargetContainerDisabled.bind(this);
        this.getContainerName = this.getContainerName.bind(this);
    }

    handleChange(checked, event) {
        if (event.target.type === "checkbox")
            this.setState({ [event.target.name]: event.target.checked });
    }

    handleTargetHostSelect(event, targetHost) {
        this.setState({ targetHost, targetHostOpen: false });

        if (targetHost !== this.targetHostPlaceholder) {
            // Update target container list based on the host
            this.setState({ targetContainerLoading: true, targetContainer: this.targetContainerLoading });
            const modal = this;
            client.getContainers(true, undefined, targetHost)
                    .then(function (containers) {
                        const newContainerList = [];
                        for (const container of containers)
                            newContainerList.push(container.Names[0]);
                        modal.setState({
                            targetContainerLoading: false,
                            targetContainer: modal.targetContainerPlaceholder,
                            targetContainerList: newContainerList
                        });
                    })
                    .catch(function() {
                        modal.setState({
                            targetContainerLoading: false,
                            targetContainerError: true,
                            targetContainer: modal.targetContainerError,
                            targetContainerList: []
                        });
                    });
        } else {
            this.setState({
                targetContainer: this.targetContainerPlaceholder,
                targetContainerList: [],
                targetContainerLoading: false,
                targetContainerError: false
            });
        }
    }

    handleTargetContainerSelect(event, targetContainer) {
        this.setState({ targetContainer, targetContainerOpen: false });
    }

    isTargetContainerDisabled() {
        return this.state.targetHost === this.targetHostPlaceholder || this.state.targetContainerLoading;
    }

    getContainerName() {
        if (this.state.targetContainer === this.targetContainerError ||
            this.state.targetContainer === this.targetContainerLoading)
            return null;

        if (this.state.targetContainer === this.targetContainerPlaceholder)
            return this.state.targetContainerName;

        return this.state.targetContainer;
    }

    render() {
        return (
            <Modal isOpen={this.props.selectContainerMigrateModal}
                   showClose={false}
                   position="top" variant="medium"
                   onClose={this.props.handleMigrateContainerDeleteModal}
                   title={_("Migrate running container to another host")}
                   footer={<>
                       <Button variant="primary" isDisabled={this.props.migrateInProgress ||
                                                             this.state.targetHost === this.targetHostPlaceholder ||
                                                             this.state.targetContainer === this.targetContainerError}
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
                       {this.props.migrateInProgress && <div className="spinner spinner-sm pull-right" />}
                   </>}
            >
                <div className="ct-form">
                    <label className="control-label" htmlFor="migrate-dialog-container">
                        {_("Container")}
                    </label>
                    <div id="migrate-dialog-container">{this.props.containerWillMigrate.Names}</div>

                    <label className="control-label" htmlFor="migrate-dialog-target-host">
                        {_("Target host")}
                    </label>
                    <Select id="migrate-dialog-target-host" isOpen={this.state.targetHostOpen}
                            selections={this.state.targetHost}
                            onToggle={targetHostOpen => this.setState({ targetHostOpen })}
                            onSelect={this.handleTargetHostSelect}>
                        {
                            Object.keys(this.props.remoteHosts).map(host =>
                                <SelectOption value={this.props.remoteHosts[host]} key={host} />)
                                    .concat([<SelectOption value={this.targetHostPlaceholder} key="_placeholder"
                                                           isPlaceholder />])
                        }
                    </Select>

                    <label className="control-label" htmlFor="migrate-dialog-target-container">
                        {_("Target container")}
                    </label>
                    <Select id="migrate-dialog-target-container" isOpen={this.state.targetContainerOpen}
                            selections={this.state.targetContainer} isDisabled={this.isTargetContainerDisabled()}
                            onToggle={targetContainerOpen => this.setState({ targetContainerOpen })}
                            onSelect={this.handleTargetContainerSelect}>
                        {
                            this.state.targetContainerList.map(container => <SelectOption value={container}
                                                                                          key={container} />)
                                    .concat([
                                        <SelectOption value={this.targetContainerPlaceholder} key="_placeholder"
                                                      isPlaceholder />,
                                        this.state.targetContainerLoading
                                            ? <SelectOption value={this.targetContainerLoading} key="_placeholder2"
                                                            isPlaceholder />
                                            : <></>,
                                        this.state.targetContainerError
                                            ? <SelectOption value={this.targetContainerError} key="_placeholder3"
                                                            isPlaceholder />
                                            : <></>
                                    ])
                        }
                    </Select>

                    {
                        (this.state.targetContainer === this.targetContainerPlaceholder &&
                         this.state.targetHost !== this.targetHostPlaceholder)
                            ? <>
                                <label className="control-label" htmlFor="migrate-container-target-name">
                                    {_("Target container name")}
                                </label>
                                <TextInput id="migrate-container-target-name" text={this.state.targetContainerName}
                                           onChange={targetContainerName =>
                                               this.setState({ targetContainerName })} />
                            </>
                            : null
                    }

                    <label className="control-label" htmlFor="migrate-dialog-keep">
                        {_("Keep all temporary checkpoint files")}
                    </label>
                    <Checkbox id="migrate-dialog-keep" name="keep" isChecked={this.state.keep}
                              onChange={this.handleChange} />

                    <label className="control-label" htmlFor="migrate-dialog-leaveRunning">
                        {_("Leave running after migration")}
                    </label>
                    <Checkbox id="migrate-dialog-leaveRunning" name="leaveRunning"
                              isChecked={this.state.leaveRunning} onChange={this.handleChange} />

                    <label className="control-label" htmlFor="migrate-dialog-tcpEstablished">
                        {_("Preserve established TCP connections")}
                    </label>
                    <Checkbox id="migrate-dialog-tcpEstablished" name="tcpEstablished"
                              isChecked={this.state.tcpEstablished} onChange={this.handleChange} />

                    <label className="control-label" htmlFor="migrate-dialog-ignoreRootFS">
                        {_("Do not migrate root file-system changes")}
                    </label>
                    <Checkbox id="migrate-dialog-ignoreRootFS" name="ignoreRootFS"
                              isChecked={this.state.ignoreRootFS} onChange={this.handleChange} />

                    <label className="control-label" htmlFor="migrate-dialog-ignoreStaticIP">
                        {_("Ignore IP address if set statically")}
                    </label>
                    <Checkbox id="migrate-dialog-ignoreStaticIP" name="ignoreStaticIP"
                              isChecked={this.state.ignoreRootFS} onChange={this.handleChange} />

                    <label className="control-label" htmlFor="migrate-dialog-ignoreStaticMAC">
                        {_("Ignore MAC address if set statically")}
                    </label>
                    <Checkbox id="migrate-dialog-ignoreStaticMAC" name="ignoreStaticMAC"
                              isChecked={this.state.ignoreStaticMAC} onChange={this.handleChange} />
                </div>
            </Modal>
        );
    }
}

export default ContainerMigrateModal;
