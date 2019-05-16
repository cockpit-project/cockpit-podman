import React from 'react';
import { Modal, Button, FormGroup, FormControl } from 'patternfly-react';
import cockpit from 'cockpit';

import * as utils from './util.js';
import varlink from './varlink.js';
import { ErrorNotification } from './Notification.jsx';

import '../lib/form-layout.less';

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
        let cmdStr = "";
        if (this.state.command.trim() === "") {
            cmdStr = this.props.container.Config ? this.props.container.Config.Cmd.join(" ") : "";
        } else {
            cmdStr = this.state.command.trim();
        }

        let commitData = {};
        commitData.name = this.props.container.id;
        commitData.image_name = this.state.tag ? this.state.imageName + ":" + this.state.tag : this.state.imageName;
        commitData.author = this.state.author;
        commitData.message = this.state.message;
        commitData.pause = this.state.pause;
        commitData.format = this.state.format;

        commitData.changes = [];
        let cmdData = "CMD=" + cmdStr;
        commitData.changes.push(cmdData);

        let onbuildsArr = [];
        if (this.state.setonbuild) {
            onbuildsArr = utils.getCommitArr(this.state.onbuild, "ONBUILD");
        }
        commitData.changes.push(...onbuildsArr);

        varlink.call(utils.PODMAN_ADDRESS, "io.podman.Commit", commitData)
                .then(() => this.props.onHide())
                .catch(ex => {
                    this.setState({
                        dialogError: cockpit.format(_("Failed to commit container $0"), this.props.container.names),
                        dialogErrorDetail: cockpit.format("$0: $1", ex.error, ex.parameters && ex.parameters.reason)
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
        let onbuilds =
            this.state.onbuild.map((bud, idx) => (
                <div key={"onbuildvar" + idx} id="select-claimed-onbuildvars" className="form-inline containers-run-onbuildvarclaim containers-run-inline" >
                    <FormGroup className="form-inline">
                        <input type="text" name="onbuildvar_key" onChange={(evt) => this.handleOnBuildsInputChange(idx, evt)} />
                        <button type="button" className="btn btn-default pficon-close" disabled={idx === 0} onClick={() => this.handleRemoveOnBuild(idx)} />
                        <button type="button" className="btn btn-default fa fa-plus" onClick={this.handleAddOnBuild} />
                    </FormGroup>
                </div>
            ));
        let commitContent =
            <div className="ct-form-layout">
                <label className="control-label" htmlFor="commit-dialog-container-name">
                    {_("Container Name")}
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
                    {_("Image Name")}
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
                    {_("On Build")}
                </label>
                <label id="commit-dialog-setonbuild-label" className="checkbox-inline">
                    <input name="setonbuild" id="commit-dialog-setonbuild" type="checkbox" disabled={this.state.onbuildDisabled} onChange={this.handleInputChange} />
                    {_("Set container on build variables")}
                </label>
                {this.state.setonbuild && onbuilds}
            </div>;

        return (
            <Modal show aria-labelledby="contained-modal-title-lg">
                <Modal.Header>
                    <Modal.Title id="contained-modal-title-lg">{_("Commit Image")}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {commitContent}
                </Modal.Body>
                <Modal.Footer>
                    {this.state.dialogError && <ErrorNotification errorMessage={this.state.dialogError} errorDetail={this.state.dialogErrorDetail} onDismiss={() => this.setState({ dialogError: undefined })} />}
                    <Button className="btn-ctr-cancel-commit" onClick={this.props.onHide}>{_("Cancel")}</Button>
                    <Button bsStyle="primary" className="btn-ctr-commit" onClick={this.handleCommit}>{_("Commit")}</Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

export default ContainerCommitModal;
