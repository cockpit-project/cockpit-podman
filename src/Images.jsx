import React from 'react';
import cockpit from 'cockpit';
import * as Listing from '../lib/cockpit-components-listing.jsx';
import ImageDetails from './ImageDetails.jsx';
import ContainersRunImageModal from './ContainersRunImageModal.jsx';
import ImageSecurity from './ImageSecurity.jsx';
import ModalExample from './ImageDeleteModal.jsx';
import ImageRemoveErrorModal from './ImageRemoveErrorModal.jsx';
import * as utils from './util.js';

const moment = require('moment');
const atomic = require('./atomic.jsx');
const _ = cockpit.gettext;

class Images extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            imageDetail: undefined,
            setRunContainer: false,
            vulnerableInfos: {},
            selectImageDeleteModal: false,
            setImageRemoveErrorModal: false,
            imageWillDelete: {},
        };

        this.vulnerableInfoChanged = this.vulnerableInfoChanged.bind(this);
        this.handleSearchImageClick = this.handleSearchImageClick.bind(this);
        this.showRunImageDialog = this.showRunImageDialog.bind(this);
        this.handleCancelRunImage = this.handleCancelRunImage.bind(this);
        this.deleteImage = this.deleteImage.bind(this);
        this.handleCancelImageDeleteModal = this.handleCancelImageDeleteModal.bind(this);
        this.handleRemoveImage = this.handleRemoveImage.bind(this);
        this.handleCancelImageRemoveError = this.handleCancelImageRemoveError.bind(this);
        this.handleForceRemoveImage = this.handleForceRemoveImage.bind(this);
        this.renderRow = this.renderRow.bind(this);
    }

    vulnerableInfoChanged(event, infos) {
        this.setState({ vulnerableInfos: infos });
    }

    componentDidMount() {
        atomic.addEventListener('vulnerableInfoChanged', this.vulnerableInfoChanged);
    }

    componentWillUnmount() {
        atomic.removeEventListener('vulnerableInfoChanged', this.vulnerableInfoChanged);
    }

    navigateToImage(image) {
        cockpit.location.go([ 'image', image.Id ]);
    }

    showRunImageDialog(e) {
        this.setState({
            setRunContainer: true
        });
    }

    deleteImage(image) {
        this.setState((prevState) => ({
            selectImageDeleteModal: !prevState.selectImageDeleteModal,
            imageWillDelete: image,
        }));
    }

    handleCancelImageDeleteModal() {
        this.setState((prevState) => ({
            selectImageDeleteModal: !prevState.selectImageDeleteModal
        }));
    }

    handleRemoveImage() {
        const image = this.state.imageWillDelete.Id;
        this.setState({
            selectImageDeleteModal: false,
        });
        utils.varlinkCall(utils.PODMAN, "io.podman.RemoveImage", {name: image})
                .then((reply) => {
                    const idDel = reply.image ? reply.image : "";
                    const oldImages = this.props.images;
                    let newImages = oldImages.filter(elm => elm.Id !== idDel);
                    this.props.updateImages(newImages);
                })
                .catch(ex => {
                    this.imageRemoveErrorMsg = _(ex);
                    this.setState({
                        setImageRemoveErrorModal: true,
                    });
                });
    }

    handleForceRemoveImage() {
        const id = this.state.imageWillDelete ? this.state.imageWillDelete.Id : "";
        utils.varlinkCall(utils.PODMAN, "io.podman.RemoveImage", {name: id, force: true})
                .then(reply => {
                    this.setState({
                        setImageRemoveErrorModal: false
                    });
                    const idDel = reply.image ? reply.image : "";
                    const oldImages = this.props.images;
                    let newImages = oldImages.filter(elm => elm.Id !== idDel);
                    this.props.updateImages(newImages);
                })
                .catch(ex => console.error("Failed to do RemoveImageForce call:", JSON.stringify(ex)));
    }

    renderRow(image) {
        let vulnerabilityColumn = '';
        let vulnerableInfo = this.state.vulnerableInfos[image.Id.replace(/^sha256:/, '')];
        let count;
        let tabs = [];

        if (vulnerableInfo) {
            count = vulnerableInfo.vulnerabilities.length;
            if (count > 0)
                vulnerabilityColumn = (
                    <div>
                        <span className="pficon pficon-warning-triangle-o" />
                        &nbsp;
                        { cockpit.format(cockpit.ngettext('1 Vulnerability', '$0 Vulnerabilities', count), count) }
                    </div>
                );
        }
        // TODO: image waiting if - else
        let element =
            <button
                key={image.Id + "runimage"}
                className="btn btn-default btn-control-ct fa fa-play"
                onClick={ this.showRunImageDialog }
                data-image={image.id}
            />;
        let columns = [
            {name: image.RepoTags ? image.RepoTags[0] : "", header: true},
            vulnerabilityColumn,
            moment(image.Created).isValid() ? moment(image.Created).calendar() : image.Created,
            cockpit.format_bytes(image.VirtualSize),
            {
                element: element,
                tight: true
            }
        ];

        tabs.push({
            name: _("Details"),
            renderer: ImageDetails,
            data: { image: image }
        });
        if (vulnerableInfo !== undefined) {
            tabs.push({
                name: _("Security"),
                renderer: ImageSecurity,
                data: {
                    image: image,
                    info: vulnerableInfo,
                }
            });
        }

        let actions = [
            <button
                key={image.Id + "delete"}
                className="btn btn-danger btn-delete pficon pficon-delete"
                onClick={() => this.deleteImage(image)}
            />
        ];
        return <Listing.ListingRow
                    key={image.Id}
                    rowId={image.Id}
                    columns={columns}
                    tabRenderers={tabs}
                    navigateToItem={this.navigateToImage(image)}
                    listingActions={actions}
        />;
    }

    handleSearchImageClick() {
        return undefined;
    }

    handleCancelRunImage() {
        this.setState(() => ({
            setRunContainer: false
        }));
    }

    handleCancelImageRemoveError() {
        this.setState({
            setImageRemoveErrorModal: false
        });
    }

    render() {
        const columnTitles = [ _("Name"), _(''), _("Created"), _("Size"), _('') ];
        let emptyCaption = '';
        if (this.props.filterText.length === 0 || this.props.filterText.length === '') {
            emptyCaption = _("No images");
        } else {
            emptyCaption = _("No images that match the current filter");
        }
        const getNewImageAction =
                [<a key={"searchImages"} role="link" tabIndex="0" onClick={this.handleSearchImageClick} className="card-pf-link-with-icon pull-right">
                    <span className="pficon pficon-add-circle-o" />{_("Get new image")}
                </a>];
        let filtered = Object.keys(this.props.images).filter(id => this.props.images[id].RepoTags && this.props.images[id].RepoTags[0].indexOf(this.props.filterText) >= 0);
        let imageRows = filtered.map(id => this.renderRow(this.props.images[id]));
        const imageDeleteModal =
            <ModalExample
                    selectImageDeleteModal={this.state.selectImageDeleteModal}
                    imageWillDelete={this.state.imageWillDelete}
                    handleCancelImageDeleteModal={this.handleCancelImageDeleteModal}
                    handleRemoveImage={this.handleRemoveImage}
            />;
        const imageRemoveErrorModal =
            <ImageRemoveErrorModal
                    setImageRemoveErrorModal={this.state.setImageRemoveErrorModal}
                    handleCancelImageRemoveError={this.handleCancelImageRemoveError}
                    handleForceRemoveImage={this.handleForceRemoveImage}
                    imageWillDelete={this.state.imageWillDelete}
                    imageRemoveErrorMsg={this.imageRemoveErrorMsg}
            />;

        return (
            <div id="containers-images" key={"images"} className="container-fluid" >
                <Listing.Listing
                            key={"ImagesListing"}
                            title={_("Images")}
                            columnTitles={columnTitles}
                            emptyCaption={emptyCaption}
                            actions={getNewImageAction}>
                    {imageRows}
                </Listing.Listing>
                {/* TODO: {pendingRows} */}
                <ContainersRunImageModal
                            show={this.state.setRunContainer}
                            handleCancelRunImage={this.handleCancelRunImage}
                />
                {imageDeleteModal}
                {imageRemoveErrorModal}
            </div>
        );
    }
}

export default Images;
