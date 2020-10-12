import React from 'react';
import { Modal } from 'patternfly-react';
import { Button, Checkbox, Select, SelectOption } from '@patternfly/react-core';
import cockpit from 'cockpit';

const _ = cockpit.gettext;
const targetHostPlaceholder = _("Choose target host...");

class ContainerMigrateModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            targetHost: targetHostPlaceholder,
            targetHostOpen: false,
            keep: false,
            leaveRunning: false,
            tcpEstablished: false,
            ignoreRootFS: false
        };
        this.handleChange = this.handleChange.bind(this);
    }

    handleChange(checked, event) {
        if (event.target.type === "checkbox")
            this.setState({ [event.target.name]: event.target.checked });
    }

    render() {
        return (
            <Modal show={this.props.selectContainerMigrateModal}>
                <Modal.Header>
                    <Modal.Title>
                        {_("Migrate running container to another host")}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
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
                                onSelect={(event, targetHost) => this.setState({ targetHost, targetHostOpen: false })}>
                            {
                                Object.keys(this.props.remoteHosts).map(host =>
                                    <SelectOption value={this.props.remoteHosts[host]} key={host} />)
                                        .concat([<SelectOption value={targetHostPlaceholder} key="_placeholder"
                                                               isPlaceholder />])
                            }
                        </Select>

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
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" isDisabled={this.props.migrateInProgress ||
                                                          this.state.targetHost === targetHostPlaceholder}
                            onClick={() => this.props.handleMigrateContainer(this.state, this.state.targetHost)}>
                        {_("Migrate")}
                    </Button>
                    <Button variant="link" onClick={this.props.handleMigrateContainerDeleteModal}>
                        {_("Cancel")}
                    </Button>
                    <label className="migration-progress">
                        {this.props.migrationStateLabel}
                    </label>
                    {this.props.migrateInProgress && <div className="spinner spinner-sm pull-right" />}
                </Modal.Footer>
            </Modal>
        );
    }
}

export default ContainerMigrateModal;
