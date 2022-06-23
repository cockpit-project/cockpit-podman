import React from 'react';
import { Button, Checkbox, Form, Modal } from '@patternfly/react-core';
import { DialogsContext } from "dialogs.jsx";
import cockpit from 'cockpit';

const _ = cockpit.gettext;

class ContainerRestoreModal extends React.Component {
    static contextType = DialogsContext;

    constructor(props) {
        super(props);
        this.state = {
            inProgress: false,
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
        const Dialogs = this.context;
        return (
            <Modal isOpen
                   showClose={false}
                   position="top" variant="medium"
                   title={cockpit.format(_("Restore container $0"), this.props.containerWillCheckpoint.Names)}
                   footer={<>
                       <Button variant="primary" isDisabled={this.state.inProgress}
                               isLoading={this.state.inProgress}
                               onClick={() => {
                                   this.setState({ inProgress: true });
                                   this.props.handleRestoreContainer({
                                       keep: this.state.keep,
                                       leaveRunning: this.state.leaveRunning,
                                       tcpEstablished: this.state.tcpEstablished,
                                       ignoreRootFS: this.state.ignoreRootFS
                                   });
                               }}>
                           {_("Restore")}
                       </Button>
                       <Button variant="link" isDisabled={this.state.inProgress}
                               onClick={Dialogs.close}>
                           {_("Cancel")}
                       </Button>
                   </>}
            >
                <Form isHorizontal>
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
