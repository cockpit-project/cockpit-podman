import React from 'react';
import { Modal } from 'patternfly-react';
import { Button, Checkbox } from '@patternfly/react-core';
import cockpit from 'cockpit';
import * as utils from './util.js';

const _ = cockpit.gettext;

class ContainerRestoreModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            keep: false,
            tcpEstablished: false,
            ignoreRootFS: false,
            ignoreStaticIP: false,
            ignoreStaticMAC: false
        };
        this.handleChange = this.handleChange.bind(this);
    }

    handleChange(checked, event) {
        if (event.target.type === "checkbox")
            this.setState({ [event.target.name]: event.target.checked });
    }

    render() {
        return (
            <Modal show={this.props.selectContainerRestoreModal}>
                <Modal.Header>
                    <Modal.Title>
                        {cockpit.format(_("Restore container $0"),
                                        utils.truncate_id(this.props.containerWillCheckpoint.Id))}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="ct-form">
                        <Checkbox label={_("Keep all temporary checkpoint files")} id="restore-dialog-keep" name="keep"
                                  isChecked={this.state.keep} onChange={this.handleChange} />
                        <Checkbox label={_("Restore with established TCP connections")}
                                  id="restore-dialog-tcpEstablished" name="tcpEstablished"
                                  isChecked={this.state.tcpEstablished} onChange={this.handleChange} />
                        <Checkbox label={_("Ignore IP address if set statically")} id="restore-dialog-ignoreStaticIP"
                                  name="ignoreStaticIP" isChecked={this.state.ignoreStaticIP}
                                  onChange={this.handleChange} />
                        <Checkbox label={_("Ignore MAC address if set statically")} id="restore-dialog-ignoreStaticMAC"
                                  name="ignoreStaticMAC" isChecked={this.state.ignoreStaticMAC}
                                  onChange={this.handleChange} />
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" isDisabled={this.props.restoreInProgress}
                            onClick={() => this.props.handleRestoreContainer(this.state)}>
                        {_("Restore")}
                    </Button>
                    <Button variant="link" onClick={this.props.handleRestoreContainerDeleteModal}>
                        {_("Cancel")}
                    </Button>
                    {this.props.restoreInProgress && <div className="spinner spinner-sm pull-right" />}
                </Modal.Footer>
            </Modal>
        );
    }
}

export default ContainerRestoreModal;
