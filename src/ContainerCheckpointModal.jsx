import React from 'react';
import { Button, Checkbox, Modal } from '@patternfly/react-core';
import cockpit from 'cockpit';

const _ = cockpit.gettext;

class ContainerCheckpointModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
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
            <Modal isOpen={this.props.selectContainerCheckpointModal}
                   position="top" variant="medium"
                   onClose={this.props.handleCheckpointContainerDeleteModal}
                   title={cockpit.format(_("Checkpoint container $0"), this.props.containerWillCheckpoint.Names)}
                   footer={<>
                       <Button variant="primary" isDisabled={this.props.checkpointInProgress}
                               onClick={() => this.props.handleCheckpointContainer(this.state)}>
                           {_("Checkpoint")}
                       </Button>
                       <Button variant="link" onClick={this.props.handleCheckpointContainerDeleteModal}>
                           {_("Cancel")}
                       </Button>
                       {this.props.checkpointInProgress && <div className="spinner spinner-sm pull-right" />}
                   </>}
            >
                <div className="ct-form">
                    <Checkbox label={_("Keep all temporary checkpoint files")} id="checkpoint-dialog-keep"
                                  name="keep" isChecked={this.state.keep} onChange={this.handleChange} />
                    <Checkbox label={_("Leave running after writing checkpoint to disk")}
                                  id="checkpoint-dialog-leaveRunning" name="leaveRunning"
                                  isChecked={this.state.leaveRunning} onChange={this.handleChange} />
                    <Checkbox label={_("Support preserving established TCP connections")}
                                  id="checkpoint-dialog-tcpEstablished" name="tcpEstablished"
                                  isChecked={this.state.tcpEstablished} onChange={this.handleChange} />
                    <Checkbox label={_("Do not include root file-system changes when exporting")}
                                  id="checkpoint-dialog-ignoreRootFS" name="ignoreRootFS"
                                  isChecked={this.state.ignoreRootFS} onChange={this.handleChange} />
                </div>
            </Modal>
        );
    }
}

export default ContainerCheckpointModal;
