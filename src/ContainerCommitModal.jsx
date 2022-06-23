import React from 'react';
import {
    Button, Checkbox,
    Form, FormGroup,
    Modal, TextInput
} from '@patternfly/react-core';
import cockpit from 'cockpit';

import * as utils from './util.js';
import * as client from './client.js';
import { ErrorNotification } from './Notification.jsx';
import { fmt_to_fragments } from 'utils.jsx';
import { DialogsContext } from "dialogs.jsx";

const _ = cockpit.gettext;

class ContainerCommitModal extends React.Component {
    static contextType = DialogsContext;

    constructor(props) {
        super(props);
        this.state = {
            imageName: "",
            tag: "",
            author:"",
            command: props.container.Command ? utils.quote_cmdline(props.container.Command) : "",
            pause: false,
            selectedFormat: "oci",
            commitInProgress: false,
            useDocker: false,
            nameError: "",
        };

        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleCommit = this.handleCommit.bind(this);
    }

    handleInputChange(targetName, value) {
        const newState = { [targetName]: value };

        if (targetName === "imageName" || targetName === "tag")
            newState.nameError = "";

        this.setState(newState);
    }

    handleCommit(force) {
        const Dialogs = this.context;

        if (!force && !this.state.imageName) {
            this.setState({ nameError: "Image name is required" });
            return;
        }

        let full_name = this.state.imageName + ":" + (this.state.tag ? this.state.tag : "latest");
        if (full_name.indexOf("/") < 0)
            full_name = "localhost/" + full_name;

        if (!force && this.props.localImages.some(image => image.isSystem === this.props.container.isSystem && image.Name === full_name)) {
            this.setState({ nameError: "Image name is not unique" });
            return;
        }

        function quote(word) {
            word = word.replace(/"/g, '\\"');
            return '"' + word + '"';
        }

        const commitData = {};
        commitData.container = this.props.container.Id;
        commitData.repo = this.state.imageName;
        commitData.author = this.state.author;
        commitData.pause = this.state.pause;

        if (this.state.useDocker)
            commitData.format = 'docker';

        if (this.state.tag)
            commitData.tag = this.state.tag;

        commitData.changes = [];
        if (this.state.command.trim() !== "") {
            let cmdData = "";
            const words = utils.unquote_cmdline(this.state.command.trim());
            const cmdStr = words.map(quote).join(", ");
            cmdData = "CMD [" + cmdStr + "]";
            commitData.changes.push(cmdData);
        }

        this.setState({ commitInProgress: true, nameError: "", dialogError: "" });
        client.commitContainer(this.props.container.isSystem, commitData)
                .then(() => Dialogs.close())
                .catch(ex => {
                    this.setState({
                        dialogError: cockpit.format(_("Failed to commit container $0"), this.props.container.Names),
                        dialogErrorDetail: cockpit.format("$0: $1", ex.message, ex.reason),
                        commitInProgress: false
                    });
                });
    }

    render() {
        const Dialogs = this.context;

        const commitContent =
            <Form isHorizontal>
                <FormGroup fieldId="commit-dialog-image-name" label={_("New image name")}
                           validated={this.state.nameError ? "error" : "default"}
                           helperTextInvalid={this.state.nameError}>
                    <TextInput id="commit-dialog-image-name"
                               value={this.state.imageName}
                               validated={this.state.nameError ? "error" : "default"}
                               onChange={value => this.handleInputChange("imageName", value)} />
                </FormGroup>

                <FormGroup fieldId="commit-dialog-image-tag" label={_("Tag")}>
                    <TextInput id="commit-dialog-image-tag"
                               placeholder="latest" // Do not translate
                               value={this.state.tag}
                               onChange={value => this.handleInputChange("tag", value)} />
                </FormGroup>

                <FormGroup fieldId="commit-dialog-author" label={_("Author")}>
                    <TextInput id="commit-dialog-author"
                               placeholder={_("Example, Your Name <yourname@example.com>")}
                               value={this.state.author}
                               onChange={value => this.handleInputChange("author", value)} />
                </FormGroup>

                <FormGroup fieldId="commit-dialog-command" label={_("Command")}>
                    <TextInput id="commit-dialog-command"
                               value={this.state.command}
                               onChange={value => this.handleInputChange("command", value)} />
                </FormGroup>

                <FormGroup fieldId="commit-dialog-pause" label={_("Options")} isStack hasNoPaddingTop>
                    <Checkbox id="commit-dialog-pause"
                              isChecked={this.state.pause}
                              onChange={value => this.handleInputChange("pause", value)}
                              label={_("Pause container when creating image")} />
                    <Checkbox id="commit-dialog-docker"
                              isChecked={this.state.useDocker}
                              onChange={value => this.handleInputChange("useDocker", value)}
                              description={_("Docker format is useful when sharing the image with Docker or Moby Engine")}
                              label={_("Use legacy Docker format")} />
                </FormGroup>
            </Form>;

        return (
            <Modal isOpen
                   showClose={false}
                   position="top" variant="medium"
                   title={_("Commit container")}
                   description={fmt_to_fragments(_("Create a new image based on the current state of the $0 container."), <b>{this.props.container.Names}</b>)}
                   footer={<>
                       {this.state.dialogError && <ErrorNotification errorMessage={this.state.dialogError} errorDetail={this.state.dialogErrorDetail} onDismiss={() => this.setState({ dialogError: undefined })} />}
                       <Button variant="primary"
                               className="btn-ctr-commit"
                               isLoading={this.state.commitInProgress && !this.state.nameError}
                               isDisabled={this.state.commitInProgress || this.state.nameError}
                               onClick={() => this.handleCommit(false)}>
                           {_("Commit")}
                       </Button>
                       {this.state.nameError && <Button variant="warning"
                               className="btn-ctr-commit-force"
                               isLoading={this.state.commitInProgress}
                               isDisabled={this.state.commitInProgress}
                               onClick={() => this.handleCommit(true)}>
                           {_("Force commit")}
                       </Button>}
                       <Button variant="link"
                               className="btn-ctr-cancel-commit"
                               isDisabled={this.state.commitInProgress}
                               onClick={Dialogs.close}>
                           {_("Cancel")}
                       </Button>
                   </>}
            >
                {commitContent}
            </Modal>
        );
    }
}

export default ContainerCommitModal;
