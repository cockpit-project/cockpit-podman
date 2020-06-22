import React from 'react';
import { Button } from '@patternfly/react-core';
import { PlusCircleIcon } from '@patternfly/react-icons';

import cockpit from 'cockpit';
import * as Listing from '../lib/cockpit-components-listing.jsx';
import ImageDetails from './ImageDetails.jsx';
import ImageUsedBy from './ImageUsedBy.jsx';
import { ImageRunModal } from './ImageRunModal.jsx';
import { ImageSearchModal } from './ImageSearchModal.jsx';
import ModalExample from './ImageDeleteModal.jsx';
import ImageRemoveErrorModal from './ImageRemoveErrorModal.jsx';
import * as utils from './util.js';

import './Images.css';

const moment = require('moment');
const _ = cockpit.gettext;

class Images extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            imageDetail: undefined,
            selectImageDeleteModal: false,
            setImageRemoveErrorModal: false,
            imageWillDelete: {},
        };

        this.deleteImage = this.deleteImage.bind(this);
        this.downloadImage = this.downloadImage.bind(this);
        this.handleCancelImageDeleteModal = this.handleCancelImageDeleteModal.bind(this);
        this.handleRemoveImage = this.handleRemoveImage.bind(this);
        this.handleCancelImageRemoveError = this.handleCancelImageRemoveError.bind(this);
        this.handleForceRemoveImage = this.handleForceRemoveImage.bind(this);
        this.renderRow = this.renderRow.bind(this);
    }

    deleteImage(image) {
        this.setState((prevState) => ({
            selectImageDeleteModal: !prevState.selectImageDeleteModal,
            imageWillDelete: image,
        }));
    }

    downloadImage(imageName, imageTag, system) {
        let pullImageId = imageName;
        if (imageTag)
            pullImageId += ":" + imageTag;

        this.setState({ imageDownloadInProgress: imageName });
        utils.podmanCall("PullImage", { name: pullImageId }, system)
                .then(() => {
                    this.setState({ imageDownloadInProgress: undefined });
                })
                .catch(ex => {
                    const error = cockpit.format(_("Failed to download image $0:$1"), imageName, imageTag || "latest");
                    const errorDetail = (<>
                        <p> {_("Error message")}:
                            <samp>{cockpit.format("$0 $1", ex.error, ex.parameters && ex.parameters.reason)}</samp>
                        </p>
                    </>);
                    this.setState({ imageDownloadInProgress: undefined });
                    this.props.onAddNotification({ type: 'danger', error, errorDetail });
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
        utils.podmanCall("RemoveImage", { name: image }, this.state.imageWillDelete.isSystem)
                .catch(ex => {
                    this.imageRemoveErrorMsg = ex.parameters.reason;
                    this.setState({
                        setImageRemoveErrorModal: true,
                    });
                });
    }

    handleForceRemoveImage() {
        const id = this.state.imageWillDelete ? this.state.imageWillDelete.id : "";
        utils.podmanCall("RemoveImage", { name: id, force: true }, this.state.imageWillDelete.isSystem)
                .then(reply => {
                    this.setState({
                        setImageRemoveErrorModal: false
                    });
                })
                .catch(ex => console.error("Failed to do RemoveImageForce call:", JSON.stringify(ex)));
    }

    renderRow(image) {
        const tabs = [];

        // TODO: image waiting if - else
        const runImage = (
            <Button key={image.id + "create"}
                variant='secondary'
                onClick={ e => {
                    e.stopPropagation();
                    this.setState({ showRunImageModal: image });
                } }
                aria-label={_("Run image")}
                data-image={image.id}>
                <span className="fa fa-play" />
            </Button>
        );
        const columns = [
            { name: image.repoTags ? image.repoTags[0] : "", header: true },
            moment(image.created, utils.GOLANG_TIME_FORMAT).calendar(),
            cockpit.format_bytes(image.size),
            image.isSystem ? _("system") : this.props.user,
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
        tabs.push({
            name: _("Used By"),
            renderer: ImageUsedBy,
            data: {
                containers: this.props.imageContainerList !== null ? this.props.imageContainerList[image.id + image.isSystem.toString()] : null,
                showAll: this.props.showAll,
            }
        });

        const actions = [
            <Button
                variant="danger"
                key={image.id + "delete"}
                className="btn-delete"
                aria-label={_("Delete image")}
                onClick={() => this.deleteImage(image)}>
                <span className="pficon pficon-delete" />
            </Button>
        ];
        return (
            <Listing.ListingRow
                    key={image.id + image.isSystem.toString()}
                    rowId={image.id + image.isSystem.toString()}
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
        const columnTitles = [_("Name"), _("Created"), _("Size"), _("Owner"), ''];
        let emptyCaption = _("No images");
        if (this.props.images === null)
            emptyCaption = "Loading...";
        else if (this.props.textFilter.length > 0)
            emptyCaption = _("No images that match the current filter");
        const getNewImageAction = [
            <Button variant="link" key="get-new-image-action"
                    onClick={() => this.setState({ showSearchImageModal: true })}
                    className="pull-right"
                    icon={<PlusCircleIcon />}>
                {_("Get new image")}
            </Button>
        ];
        let filtered = [];
        if (this.props.images !== null) {
            filtered = Object.keys(this.props.images);
            if (this.props.textFilter.length > 0) {
                filtered = filtered.filter(id =>
                    (this.props.images[id].repoTags || []).some(tag =>
                        tag.toLowerCase().indexOf(this.props.textFilter.toLowerCase()) >= 0)
                );
            }
        }

        filtered.sort((a, b) => {
            // User images are in front of system ones
            if (this.props.images[a].isSystem !== this.props.images[b].isSystem)
                return this.props.images[a].isSystem ? 1 : -1;
            const name_a = this.props.images[a].repoTags ? this.props.images[a].repoTags[0] : "";
            const name_b = this.props.images[b].repoTags ? this.props.images[b].repoTags[0] : "";
            if (name_a === "")
                return 1;
            if (name_b === "")
                return -1;
            return name_a > name_b ? 1 : -1;
        });

        const imageRows = filtered.map(id => this.renderRow(this.props.images[id]));
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
            <div id="containers-images" key="images" className="containers-images">
                <Listing.Listing
                            key="ImagesListing"
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
                    downloadImage={this.downloadImage}
                    user={this.props.user}
                    userServiceAvailable={this.props.userServiceAvailable}
                    systemServiceAvailable={this.props.systemServiceAvailable} /> }
                {this.state.imageDownloadInProgress && <div className='download-in-progress'> {_("Pulling")} {this.state.imageDownloadInProgress}... </div>}
            </div>
        );
    }
}

export default Images;
