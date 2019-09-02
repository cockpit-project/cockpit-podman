import React from 'react';
import { Button } from 'patternfly-react';

import cockpit from 'cockpit';
import * as Listing from '../lib/cockpit-components-listing.jsx';
import ImageDetails from './ImageDetails.jsx';
import ImageUsedBy from './ImageUsedBy.jsx';
import { ImageRunModal } from './ImageRunModal.jsx';
import { ImageSearchModal } from './ImageSearchModal.jsx';
import ImageSecurity from './ImageSecurity.jsx';
import ModalExample from './ImageDeleteModal.jsx';
import ImageRemoveErrorModal from './ImageRemoveErrorModal.jsx';
import * as utils from './util.js';
import atomic from './atomic.jsx';
import varlink from './varlink.js';

import './Images.css';

const moment = require('moment');
const _ = cockpit.gettext;

class Images extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            imageDetail: undefined,
            vulnerableInfos: {},
            selectImageDeleteModal: false,
            setImageRemoveErrorModal: false,
            imageWillDelete: {},
        };

        this.vulnerableInfoChanged = this.vulnerableInfoChanged.bind(this);
        this.deleteImage = this.deleteImage.bind(this);
        this.downloadImage = this.downloadImage.bind(this);
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

    deleteImage(image) {
        this.setState((prevState) => ({
            selectImageDeleteModal: !prevState.selectImageDeleteModal,
            imageWillDelete: image,
        }));
    }

    downloadImage(imageName, imageTag) {
        let pullImageId = imageName;
        if (imageTag)
            pullImageId += ":" + imageTag;

        this.setState({ imageDownloadInProgress: imageName });
        varlink.call(utils.PODMAN_ADDRESS, "io.podman.PullImage", { name: pullImageId })
                .then(() => {
                    this.setState({ imageDownloadInProgress: undefined });
                })
                .catch(ex => {
                    let error = (
                        <React.Fragment>
                            <strong>
                                {cockpit.format(_("Failed to download image $0:$1"), imageName, imageTag || "latest")}
                            </strong>
                            <p> {_("Error message")}:
                                <samp>{cockpit.format("$0 $1", ex.error, ex.parameters && ex.parameters.reason)}</samp>
                            </p>
                        </React.Fragment>
                    );
                    this.setState({ imageDownloadInProgress: undefined });
                    this.props.onAddNotification({ type: 'error', children: error });
                });
    }

    handleCancelImageDeleteModal() {
        this.setState((prevState) => ({
            selectImageDeleteModal: !prevState.selectImageDeleteModal
        }));
    }

    handleRemoveImage() {
        const image = this.state.imageWillDelete.id;
        this.setState({
            selectImageDeleteModal: false,
        });
        varlink.call(utils.PODMAN_ADDRESS, "io.podman.RemoveImage", { name: image })
                .catch(ex => {
                    this.imageRemoveErrorMsg = ex.parameters.reason;
                    this.setState({
                        setImageRemoveErrorModal: true,
                    });
                });
    }

    handleForceRemoveImage() {
        const id = this.state.imageWillDelete ? this.state.imageWillDelete.id : "";
        varlink.call(utils.PODMAN_ADDRESS, "io.podman.RemoveImage", { name: id, force: true })
                .then(reply => {
                    this.setState({
                        setImageRemoveErrorModal: false
                    });
                })
                .catch(ex => console.error("Failed to do RemoveImageForce call:", JSON.stringify(ex)));
    }

    renderRow(image) {
        let vulnerabilityColumn = '';
        let vulnerableInfo = this.state.vulnerableInfos[image.id.replace(/^sha256:/, '')];
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
        let runImage = (
            <Button key={image.id + "create"}
                className="btn btn-default btn-control-ct fa fa-play"
                onClick={ e => {
                    e.stopPropagation();
                    this.setState({ showRunImageModal: image });
                } }
                data-image={image.id} />
        );
        let columns = [
            { name: image.repoTags ? image.repoTags[0] : "", header: true },
            vulnerabilityColumn,
            moment(image.created, utils.GOLANG_TIME_FORMAT).calendar(),
            cockpit.format_bytes(image.size),
            {
                element: runImage,
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
        tabs.push({
            name: _("Used By"),
            renderer: ImageUsedBy,
            data: {
                containers: this.props.imageContainerList !== null ? this.props.imageContainerList[image.id] : null,
                showAll: this.props.showAll,
            }
        });

        let actions = [
            <button
                key={image.id + "delete"}
                className="btn btn-danger btn-delete pficon pficon-delete"
                onClick={() => this.deleteImage(image)}
            />
        ];
        return (
            <Listing.ListingRow
                    key={image.id}
                    rowId={image.id}
                    columns={columns}
                    tabRenderers={tabs}
                    listingActions={actions} />
        );
    }

    handleCancelImageRemoveError() {
        this.setState({
            setImageRemoveErrorModal: false
        });
    }

    render() {
        const columnTitles = [ _("Name"), _(''), _("Created"), _("Size"), _('') ];
        let emptyCaption = _("No images");
        if (this.props.images === null)
            emptyCaption = "Loading...";
        else if (this.props.textFilter.length > 0)
            emptyCaption = _("No images that match the current filter");
        const getNewImageAction = [
            <a key="get-new-image-action" role="link" tabIndex="0"
               onClick={() => this.setState({ showSearchImageModal: true })}
               className="card-pf-link-with-icon pull-right">
                <span className="pficon pficon-add-circle-o" />
                {_("Get new image")}
            </a>
        ];
        let filtered = [];
        if (this.props.images !== null)
            filtered = Object.keys(this.props.images).filter(id => id === this.props.images[id].id);
        if (this.props.textFilter.length > 0)
            filtered = filtered.filter(id => {
                for (let i = 0; i < this.props.images[id].repoTags.length; i++) {
                    let tag = this.props.images[id].repoTags[i].toLowerCase();
                    if (tag.indexOf(this.props.textFilter.toLowerCase()) >= 0)
                        return true;
                }
                return false;
            });
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
            <div id="containers-images" key={"images"} className="containers-images" >
                <Listing.Listing
                            key={"ImagesListing"}
                            title={_("Images")}
                            columnTitles={columnTitles}
                            emptyCaption={emptyCaption}
                            actions={getNewImageAction}>
                    {imageRows}
                </Listing.Listing>
                {imageDeleteModal}
                {imageRemoveErrorModal}
                {this.state.showRunImageModal &&
                <ImageRunModal
                    close={() => this.setState({ showRunImageModal: undefined })}
                    image={this.state.showRunImageModal} /> }
                {this.state.showSearchImageModal &&
                <ImageSearchModal
                    close={() => this.setState({ showSearchImageModal: false })}
                    downloadImage={this.downloadImage} /> }
                {this.state.imageDownloadInProgress && <div className='download-in-progress'> {_("Pulling")} {this.state.imageDownloadInProgress}... </div>}
            </div>
        );
    }
}

export default Images;
