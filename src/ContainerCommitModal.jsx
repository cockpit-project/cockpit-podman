import React from 'react';
import { FormGroup, FormControl } from 'patternfly-react';
import { Button, Modal } from '@patternfly/react-core';
import cockpit from 'cockpit';

import * as utils from './util.js';
import * as client from './client.js';
import { ErrorNotification } from './Notification.jsx';

import '../lib/form-layout.scss';

const _ = cockpit.gettext;

class ContainerCommitModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            imageName: "",
            tag: "",
            author:"",
            message: "",
            command: props.container.command ? utils.quote_cmdline(props.container.command) : "",
            pause: true,
            setonbuild: false,
            onbuild: [""],
            format: "oci",
            selectedFormat: "oci",
            onbuildDisabled: true,
            commitInProgress: false,
        };

        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleCommit = this.handleCommit.bind(this);
        this.handleOnBuildsInputChange = this.handleOnBuildsInputChange.bind(this);
        this.handleAddOnBuild = this.handleAddOnBuild.bind(this);
        this.handleRemoveOnBuild = this.handleRemoveOnBuild.bind(this);
    }

    handleOnBuildsInputChange(idx, evt) {
        const newOnbuilds = this.state.onbuild.map((bud, sidx) => {
            if (idx !== sidx) return bud;
            bud = evt.target.value;
            return bud;
        });

        this.setState({ onbuild: newOnbuilds });
    }

    handleAddOnBuild() {
        this.setState({ onbuild: this.state.onbuild.concat([""]) });
    }

    handleRemoveOnBuild(idx) {
        this.setState({ onbuild: this.state.onbuild.filter((bud, sidx) => idx !== sidx) });
    }

    handleInputChange(event) {
        const target = event.target;
        const value = target.type === 'checkbox' ? target.checked : target.value;
        const name = target.name;
        this.setState({
            [name]: value
        });
    }

    handleCommit() {
        if (!this.state.imageName) {
            this.setState({ dialogError: "Image name is required" });
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
        commitData.format = this.state.format;

        if (this.state.comment)
            commitData.comment = this.state.comment;

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

        let onbuildsArr = [];
        if (this.state.setonbuild) {
            onbuildsArr = utils.getCommitArr(this.state.onbuild, "ONBUILD");
        }
        commitData.changes.push(...onbuildsArr);

        this.setState({ commitInProgress: true });
        client.commitContainer(this.props.container.isSystem, commitData)
                .then(() => this.props.onHide())
                .catch(ex => {
                    this.setState({
                        dialogError: cockpit.format(_("Failed to commit container $0"), this.props.container.names),
                        dialogErrorDetail: cockpit.format("$0: $1", ex.message, ex.reason),
                        commitInProgress: false
                    });
                });
    }

    handleFormatChange(event) {
        const selectItem = event.target.value;
        this.setState({
            selectedFormat: selectItem,
            format: selectItem,
            onbuildDisabled: selectItem === "oci"
        });
    }

    render() {
        const onbuilds =
            this.state.onbuild.map((bud, idx) => (
                <div key={"onbuildvar" + idx} id="select-claimed-onbuildvars" className="form-inline containers-run-onbuildvarclaim containers-run-inline">
                    <FormGroup className="form-inline">
                        <input type="text" name="onbuildvar_key" onChange={(evt) => this.handleOnBuildsInputChange(idx, evt)} />
                        <Button variant="secondary" isDisabled={idx === 0}
                                aria-label={_("Remove on build variable")}
                                onClick={() => this.handleRemoveOnBuild(idx)}>
                            <span className="pficon pficon-close" />
                        </Button>
                        <Button variant="secondary" onClick={this.handleAddOnBuild}
                                aria-label={_("Add on build variable")}>
                            <span className="fa fa-plus" />
                        </Button>
                    </FormGroup>
                </div>
            ));
        const commitContent =
            <div className="ct-form">
                <label className="control-label" htmlFor="commit-dialog-container-name">
                    {_("Container name")}
                </label>
                <span id="commit-dialog-container-name">
                    {this.props.container.names}
                </span>

                <label className="control-label" htmlFor="commit-dialog-format">
                    {_("Format")}
                </label>

                <fieldset className='form-inline'>
                    <div className='radio'>
                        <label htmlFor="format-oci">
                            <input type="radio" id="format-oci" value="oci"
                                   checked={this.state.selectedFormat === 'oci'}
                                   onChange={(event) => this.handleFormatChange(event)} />
                            oci
                        </label>
                        <label htmlFor="format-docker">
                            <input type="radio" id="format-docker" value="docker"
                                   checked={this.state.selectedFormat === 'docker'}
                                   onChange={(event) => this.handleFormatChange(event)} />
                            docker
                        </label>
                    </div>
                </fieldset>

                <label className="control-label" htmlFor="commit-dialog-image-name">
                    {_("Image name")}
                </label>
                <FormControl name="imageName" id="commit-dialog-image-name" type="text" onChange={this.handleInputChange} />

                <label className="control-label" htmlFor="commit-dialog-image-tag">
                    {_("Tag")}
                </label>
                <FormControl name="tag" id="commit-dialog-image-tag" type="text" onChange={this.handleInputChange} />

                <label className="control-label" htmlFor="commit-dialog-author">
                    {_("Author")}
                </label>
                <FormControl name="author" id="commit-dialog-author" type="text" onChange={this.handleInputChange} />

                <label className="control-label" htmlFor="commit-dialog-message">
                    {_("Message")}
                </label>
                <FormControl name="message" id="commit-dialog-message" type="text" onChange={this.handleInputChange} />

                <label className="control-label" htmlFor="commit-dialog-command">
                    {_("Command")}
                </label>
                <FormControl name="command" id="commit-dialog-command" type="text" onChange={this.handleInputChange} />

                <label className="control-label" htmlFor="commit-dialog-pause">
                    {_("Pause")}
                </label>
                <label className="checkbox-inline">
                    <input name="pause" id="commit-dialog-pause" type="checkbox" defaultChecked onChange={this.handleInputChange} />
                    {_("Pause the container")}
                </label>

                <label className="control-label" htmlFor="commit-dialog-setonbuild">
                    {_("On build")}
                </label>
                <label id="commit-dialog-setonbuild-label" className="checkbox-inline">
                    <input name="setonbuild" id="commit-dialog-setonbuild" type="checkbox" disabled={this.state.onbuildDisabled} onChange={this.handleInputChange} />
                    {_("Set container on build variables")}
                </label>
                {this.state.setonbuild && onbuilds}
            </div>;

        return (
            <Modal isOpen
                   position="top" variant="medium"
                   onClose={this.props.onHide}
                   title={_("Commit image")}
                   footer={<>
                       {this.state.dialogError && <ErrorNotification errorMessage={this.state.dialogError} errorDetail={this.state.dialogErrorDetail} onDismiss={() => this.setState({ dialogError: undefined })} />}
                       <Button variant="primary" className="btn-ctr-commit" isDisabled={this.state.commitInProgress} onClick={this.handleCommit}>{_("Commit")}</Button>
                       <Button variant="link" className="btn-ctr-cancel-commit" onClick={this.props.onHide}>{_("Cancel")}</Button>
                       {this.state.commitInProgress && <div className="spinner spinner-sm pull-right" />}
                   </>}
            >
                {commitContent}
            </Modal>
        );
    }
}

export default ContainerCommitModal;
