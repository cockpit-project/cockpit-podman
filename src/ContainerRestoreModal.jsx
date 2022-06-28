import React from 'react';
import { Button, Checkbox, Form, Modal } from '@patternfly/react-core';
import { DialogsContext } from "dialogs.jsx";
import cockpit from 'cockpit';

import * as client from './client.js';

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

    handleRestoreContainer(args) {
        const Dialogs = this.context;
        const container = this.props.containerWillRestore;
        this.setState({ inProgress: true });
        client.postContainer(container.isSystem, "restore", container.Id, args)
                .catch(ex => {
                    const error = cockpit.format(_("Failed to restore container $0"), container.Names);
                    this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                    this.setState({ inProgress: false });
                })
                .finally(() => {
                    Dialogs.close();
                });
    }

    render() {
        const Dialogs = this.context;
        return (
            <Modal isOpen
                   showClose={false}
                   position="top" variant="medium"
                   title={cockpit.format(_("Restore container $0"), this.props.containerWillRestore.Names)}
                   footer={<>
                       <Button variant="primary" isDisabled={this.state.inProgress}
                               isLoading={this.state.inProgress}
                               onClick={() => {
                                   this.handleRestoreContainer({
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
