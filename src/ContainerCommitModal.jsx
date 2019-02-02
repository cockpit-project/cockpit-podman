import React from 'react';
import {Alert, Modal, Button, FormGroup, Grid, Form, FormControl} from 'patternfly-react';
import cockpit from 'cockpit';

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
        this.state = {...this.initialState};
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
            console.log(bud);
            console.log(evt.target.value);
            bud = evt.target.value;
            return bud;
        });

        this.setState({onbuild: newOnbuilds});
    }

    handleAddOnBuild() {
        this.setState({onbuild: this.state.onbuild.concat([""])});
    }

    handleRemoveOnBuild(idx) {
        this.setState({onbuild: this.state.onbuild.filter((bud, sidx) => idx !== sidx)});
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
            <div>
                <Form horizontal>
                    <FormGroup controlId="name" disabled={false}>
                        <Grid.Col componentClass={Form.ControlLabel} sm={3}>
                            {_("Container Name")}
                        </Grid.Col>
                        <Grid.Col sm={9}>
                            <span className="control-label" />{this.props.containerWillCommit.names}
                        </Grid.Col>
                    </FormGroup>
                    <FormGroup controlId="format" disabled={false}>
                        <Grid.Col componentClass={Form.ControlLabel} sm={3}>
                            {_("Format")}
                        </Grid.Col>
                        <Grid.Col>
                            <label htmlFor="format-oci">
                                <input type="radio" id="format-oci" value="oci" checked={this.state.selectedFormat === 'oci'} onChange={(event) => this.handleFormatChange(event)} />
                                <span>oci</span>
                            </label>
                            <label htmlFor="format-docker">
                                <input type="radio" id="format-docker" value="docker" checked={this.state.selectedFormat === 'docker'} onChange={(event) => this.handleFormatChange(event)} />
                                <span>docker</span>
                            </label>
                        </Grid.Col>
                    </FormGroup>

                    <FormGroup controlId="imageName" disabled={false}>
                        <Grid.Col componentClass={Form.ControlLabel} sm={3}>
                            {_("Image Name")}
                        </Grid.Col>
                        <Grid.Col sm={9}>
                            <FormControl name="imageName" className="form-control" type="text" onChange={this.handleInputChange} />
                        </Grid.Col>
                    </FormGroup>
                    <FormGroup controlId="tag" disabled={false}>
                        <Grid.Col componentClass={Form.ControlLabel} sm={3}>
                            {_("Tag")}
                        </Grid.Col>
                        <Grid.Col sm={9}>
                            <FormControl name="tag" className="form-control" type="text" onChange={this.handleInputChange} />
                        </Grid.Col>
                    </FormGroup>
                    <FormGroup controlId="author" disabled={false}>
                        <Grid.Col componentClass={Form.ControlLabel} sm={3}>
                            {_("Author")}
                        </Grid.Col>
                        <Grid.Col sm={9}>
                            <FormControl name="author" className="form-control" type="text" onChange={this.handleInputChange} />
                        </Grid.Col>
                    </FormGroup>
                    <FormGroup controlId="message" disabled={false}>
                        <Grid.Col componentClass={Form.ControlLabel} sm={3}>
                            {_("Message")}
                        </Grid.Col>
                        <Grid.Col sm={9}>
                            <FormControl name="message" className="form-control" type="text" onChange={this.handleInputChange} />
                        </Grid.Col>
                    </FormGroup>
                    <FormGroup controlId="command" disabled={false}>
                        <Grid.Col componentClass={Form.ControlLabel} sm={3}>
                            {_("Command")}
                        </Grid.Col>
                        <Grid.Col sm={9}>
                            <FormControl name="command" className="form-control" type="text" onChange={this.handleInputChange} />
                        </Grid.Col>
                    </FormGroup>
                    <FormGroup controlId="setonbuild" disabled={false}>
                        <Grid.Col componentClass={Form.ControlLabel} sm={3}>
                            {_("Pause")}
                        </Grid.Col>
                        <Grid.Col sm={9}>
                            <label>
                                <input name="pause" type="checkbox" defaultChecked onChange={this.handleInputChange} />
                                <span>{_("pause the container")}</span>
                            </label>
                        </Grid.Col>
                    </FormGroup>
                    <FormGroup controlId="setonbuild" disabled={false}>
                        <Grid.Col componentClass={Form.ControlLabel} sm={3}>
                            {_("On Build")}
                        </Grid.Col>
                        <Grid.Col sm={9}>
                            <label>
                                <input name="setonbuild" className="container-label" type="checkbox" disabled={this.state.onbuildDisabled} onChange={this.handleInputChange} />
                                <span>{_("Set container on build variables")}</span>
                            </label>
                            {(this.state.setonbuild && <div>{onbuilds}</div>) }
                        </Grid.Col>
                    </FormGroup>
                </Form>
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
