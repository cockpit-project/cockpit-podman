import React from 'react';
import {Modal, Button} from 'patternfly-react';
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
            command: this.props.containerWillCommit.Config ? this.props.containerWillCommit.Config.Cmd.join(" ") : "",
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

    // TODO
    handleCommit() {

    }

    handleCancel() {
        this.props.handleCancelContainerCommitModal();
        this.setState(this.initialState);
    }

    render() {
        let onbuilds =
            this.state.onbuild.map((bud, idx) => (
                <div key={"onbuildvar" + idx} id="select-claimed-onbuildvars" className="form-inline containers-run-onbuildvarclaim containers-run-inline" >
                    <form className="form-inline">
                        <button type="button" className="btn btn-default fa fa-plus" onClick={this.handleAddOnBuild} />
                        <button type="button" className="btn btn-default pficon-close" disabled={idx === 0} onClick={() => this.handleRemoveOnBuild(idx)} />
                        <div>
                            <input type="text" name="onbuildvar_key" onChange={(evt) => this.handleOnBuildsInputChange(idx, evt)} />
                        </div>
                    </form>
                </div>
            ));

        let commitContent =
            <div>
                <form className="form-horizontal">
                    {/* <tbody> */}
                    <div className="form-group">
                        <label className="col-sm-3 control-label">{_("Container Name")}</label>

                        <div className="col-sm-9">
                            <span className="control-label" />{this.props.containerWillCommit.Name}
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="col-sm-3 control-label">{_("Format")}</label>
                        <div className="col-sm-9">
                            <label htmlFor="format-oci">
                                <input type="radio" id="format-oci" value="oci" checked={this.state.selectedFormat === 'oci'} onChange={(event) => this.handleFormatChange(event)} />
                                <span>oci</span>
                            </label>
                            <label htmlFor="format-docker">
                                <input type="radio" id="format-docker" value="docker" checked={this.state.selectedFormat === 'docker'} onChange={(event) => this.handleFormatChange(event)} />
                                <span>docker</span>
                            </label>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="col-sm-3 control-label">{_("Image Name")}</label>
                        <div className="col-sm-9">
                            <input name="imageName" className="form-control" type="text" onChange={this.handleInputChange} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="col-sm-3 control-label">{_("Tag")}</label>
                        <div className="col-sm-9">
                            <input name="tag" className="form-control" type="text" onChange={this.handleInputChange} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="col-sm-3 control-label">{_("Author")}</label>
                        <div className="col-sm-9">
                            <input name="author" className="form-control" type="text" onChange={this.handleInputChange} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="col-sm-3 control-label">{_("Message")}</label>
                        <div className="col-sm-9">
                            <input name="message" className="form-control" type="text" onChange={this.handleInputChange} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="col-sm-3 control-label">{_("Command")}</label>
                        <div className="col-sm-9">
                            <input name="command" className="form-control" type="text" defaultValue={this.props.containerWillCommit.Config ? this.props.containerWillCommit.Config.Cmd.join(" ") : ""} onChange={this.handleInputChange} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="col-sm-3 control-label">{_("Pause")}</label>
                        <div className="col-sm-9">
                            <label>
                                <input name="pause" type="checkbox" defaultChecked onChange={this.handleInputChange} />
                                <span>{_("pause the container")}</span>
                            </label>
                            <div className="containers-run-inline" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="col-sm-3 control-label">{_("On Build")}</label>
                        <div className="col-sm-9">
                            <label>
                                <input name="setonbuild" className="container-label" type="checkbox" disabled={this.state.onbuildDisabled} onChange={this.handleInputChange} />
                                <span>{_("Set container on build variables")}</span>
                            </label>
                            {(this.state.setonbuild && <div>{onbuilds}</div>) }
                        </div>
                    </div>
                </form>
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
                    <Button className="btn-ctr-cancel-commit" onClick={this.handleCancel}>{_("Cancel")}</Button>
                    <Button bsStyle="primary" className="btn-ctr-commit" onClick={this.handleCommit}>{_("Commit")}</Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

export default ContainerCommitModal;
