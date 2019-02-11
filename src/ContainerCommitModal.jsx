import React from 'react';
import { Alert, Modal, Button, FormGroup, FormControl } from 'patternfly-react';
import cockpit from 'cockpit';

import '../lib/form-layout.less';

const _ = cockpit.gettext;

class ContainerCommitModal extends React.Component {
    constructor(props) {
        super(props);
        this.initialState = {
            imageName: "",
            tag: "",
            author:"",
            message: "",
            command: this.props.containerWillCommit.command ? this.props.containerWillCommit.command.join(" ") : "",
            pause: true,
            setonbuild: false,
            onbuild: [""],
            format: "oci",
            selectedFormat: "oci",
            onbuildDisabled: true,
        };
        this.state = { ...this.initialState };
        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
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

    handleFormatChange(event) {
        const selectItem = event.target.value;
        this.setState({
            selectedFormat: selectItem,
            format: selectItem,
            onbuildDisabled: selectItem === "oci"
        });
    }

    handleCommit() {
        this.props.handleContainerCommit(this.state);
        this.setState(this.initialState);
    }

    handleCancel() {
        this.props.handleCancelContainerCommitModal();
        this.setState(this.initialState);
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
                    {this.props.containerWillCommit.names}
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
            <Modal
                show={this.props.setContainerCommitModal}
                aria-labelledby="contained-modal-title-lg"
            >
                <Modal.Header>
                    <Modal.Title id="contained-modal-title-lg">{_("Commit Image")}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {commitContent}
                </Modal.Body>
                <Modal.Footer>
                    {this.props.dialogError && (<Alert onDismiss={this.props.dialogErrorDismiss}> {this.props.dialogError} </Alert>)}
                    <Button className="btn-ctr-cancel-commit" onClick={this.handleCancel}>{_("Cancel")}</Button>
                    <Button bsStyle="primary" className="btn-ctr-commit" onClick={this.handleCommit}>{_("Commit")}</Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

export default ContainerCommitModal;
