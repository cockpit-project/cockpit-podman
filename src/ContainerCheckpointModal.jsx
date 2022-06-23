import React from 'react';
import { Button, Checkbox, Form, Modal } from '@patternfly/react-core';
import { DialogsContext } from "dialogs.jsx";
import cockpit from 'cockpit';

const _ = cockpit.gettext;

class ContainerCheckpointModal extends React.Component {
    static contextType = DialogsContext;

    constructor(props) {
        super(props);
        this.state = {
            inProgress: false,
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
        const Dialogs = this.context;
        return (
            <Modal isOpen
                   showClose={false}
                   position="top" variant="medium"
                   title={cockpit.format(_("Checkpoint container $0"), this.props.containerWillCheckpoint.Names)}
                   footer={<>
                       <Button variant="primary" isDisabled={this.state.inProgress}
                               isLoading={this.state.inProgress}
                               onClick={() => {
                                   this.setState({ inProgress: true });
                                   this.props.handleCheckpointContainer({
                                       keep: this.state.keep,
                                       leaveRunning: this.state.leaveRunning,
                                       tcpEstablished: this.state.tcpEstablished,
                                       ignoreRootFS: this.state.ignoreRootFS
                                   });
                               }}>
                           {_("Checkpoint")}
                       </Button>
                       <Button variant="link" isDisabled={this.state.inProgress}
                               onClick={Dialogs.close}>
                           {_("Cancel")}
                       </Button>
                   </>}
            >
                <Form isHorizontal>
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
                </Form>
            </Modal>
        );
    }
}

export default ContainerCheckpointModal;
