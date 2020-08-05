import React from 'react';
import { Button, Checkbox, FileUpload, Form, Modal } from '@patternfly/react-core';
import cockpit from 'cockpit';
import * as utils from './util.js';

const _ = cockpit.gettext;

class ContainerRestoreModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            checkboxes: {
                keep: false,
                tcpEstablished: false,
                ignoreRootFS: false,
                ignoreStaticIP: false,
                ignoreStaticMAC: false,
                useLocalCheckpoint: false
            },
            containerName: "",
            tarball: "",
            tarballFilename: ""
        };
        this.handleCheckboxChange = this.handleCheckboxChange.bind(this);
    }

    handleCheckboxChange(checked, event) {
        const name = event.target.name;
        this.setState(state => ({ checkboxes: Object.assign(state.checkboxes, { [name]: checked }) }));
    }

    usingLocalCheckpoint() {
        return this.state.checkboxes.useLocalCheckpoint && this.props.containerWillCheckpoint.hasCheckpoint;
    }

    podmanParameters() {
        const result = Object.assign({ import: !this.usingLocalCheckpoint() }, this.state.checkboxes);
        delete result.useLocalCheckpoint;
        return result;
    }

    render() {
        return (
            <Modal isOpen={this.props.selectContainerRestoreModal}
                   showClose={false}
                   position="top" variant="medium"
                   title={cockpit.format(_("Restore container $0"), utils.truncate_id(this.props.containerWillCheckpoint.Id))}
                   footer={<>
                       <Button variant="primary"
                               isDisabled={this.props.restoreInProgress ||
                                           (!this.usingLocalCheckpoint() && this.state.tarball === "")}
                               isLoading={this.props.restoreInProgress}
                               onClick={() => this.props.handleRestoreContainer(this.podmanParameters(),
                                                                                this.state.tarball)}>
                           {_("Restore")}
                       </Button>
                       <Button variant="link" isDisabled={this.props.restoreInProgress}
                               onClick={this.props.handleRestoreContainerDeleteModal}>
                           {_("Cancel")}
                       </Button>
                   </>}
            >
                <Form isHorizontal>
                    <FileUpload isDisabled={this.usingLocalCheckpoint()} id="restore-dialog-checkpoint-upload"
                                filenamePlaceholder={_("Select the checkpoint tarball...")}
                                onChange={(value, filename) =>
                                    this.setState({ tarball: value, tarballFilename: filename })}
                                value={this.state.tarball} filename={this.state.tarballFilename} />
                    <Checkbox label={_("Use local checkpoint")} id="restore-dialog-use-local-checkpoint"
                              name="useLocalCheckpoint" onChange={this.handleCheckboxChange}
                              isChecked={this.usingLocalCheckpoint()}
                              isDisabled={!this.props.containerWillCheckpoint.hasCheckpoint} />
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
                </Form>
            </Modal>
        );
    }
}

export default ContainerRestoreModal;
