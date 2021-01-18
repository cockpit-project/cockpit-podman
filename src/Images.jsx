import React from 'react';
import {
    Button,
    Card, CardBody, CardHeader, CardTitle, CardActions,
    Text, TextVariants
} from '@patternfly/react-core';
import { PlayIcon, PlusIcon, TrashIcon } from '@patternfly/react-icons';

import cockpit from 'cockpit';
import { ListingTable } from "cockpit-components-table.jsx";
import { ListingPanel } from 'cockpit-components-listing-panel.jsx';
import ImageDetails from './ImageDetails.jsx';
import ImageUsedBy from './ImageUsedBy.jsx';
import { ImageRunModal } from './ImageRunModal.jsx';
import { ImageSearchModal } from './ImageSearchModal.jsx';
import { ImageDeleteModal } from './ImageDeleteModal.jsx';
import ForceRemoveModal from './ForceRemoveModal.jsx';
import * as client from './client.js';
import * as utils from './util.js';

import './Images.css';

const _ = cockpit.gettext;

class Images extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            imageDetail: undefined,
            selectImageDeleteModal: false,
            setImageRemoveErrorModal: false,
            imageWillDelete: {},
            intermediateOpened: false,
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
        client.pullImage(system, pullImageId)
                .then(() => {
                    this.setState({ imageDownloadInProgress: undefined });
                })
                .catch(ex => {
                    const error = cockpit.format(_("Failed to download image $0:$1"), imageName, imageTag || "latest");
                    const errorDetail = (<>
                        <p> {_("Error message")}:
                            <samp>{cockpit.format("$0 $1", ex.message, ex.reason)}</samp>
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

    handleRemoveImage(tags, all) {
        const image = this.state.imageWillDelete.Id;
        this.setState({
            selectImageDeleteModal: false,
        });
        if (all)
            client.delImage(this.state.imageWillDelete.isSystem, image, false)
                    .catch(ex => {
                        this.imageRemoveErrorMsg = ex.message;
                        this.setState({
                            setImageRemoveErrorModal: true,
                        });
                    });
        else {
            // Call another untag once previous one resolved. Calling all at once can result in undefined behavior
            const tag = tags.shift();
            const i = tag.lastIndexOf(":");
            client.untagImage(this.state.imageWillDelete.isSystem, image, tag.substring(0, i), tag.substring(i + 1, tag.length))
                    .then(() => {
                        if (tags.length > 0)
                            this.handleRemoveImage(tags, all);
                    })
                    .catch(ex => {
                        const error = cockpit.format(_("Failed to remove image $0"), tag);
                        this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                    });
        }
    }

    handleForceRemoveImage() {
        const id = this.state.imageWillDelete ? this.state.imageWillDelete.Id : "";
        return client.delImage(this.state.imageWillDelete.isSystem, id, true)
                .then(reply => {
                    this.setState({
                        setImageRemoveErrorModal: false
                    });
                })
                .catch(ex => {
                    const error = cockpit.format(_("Failed to force remove image $0"), this.state.imageWillDelete.RepoTags[0]);
                    this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                });
    }

    renderRow(image) {
        const tabs = [];

        const runImage = (
            <Button key={image.Id + "create"}
                    variant='secondary'
                    onClick={ e => {
                        e.stopPropagation();
                        this.setState({ showRunImageModal: image });
                    } }
                    aria-label={_("Run image")}
                    isSmall
                    icon={<PlayIcon />}
                    data-image={image.Id} />
        );

        const columns = [
            { title: image.RepoTags ? image.RepoTags[0] : "<none>:<none>", header: true },
            utils.localize_time(image.Created),
            cockpit.format_bytes(image.Size),
            image.isSystem ? _("system") : this.props.user,
            { title: runImage },
        ];

        tabs.push({
            name: _("Details"),
            renderer: ImageDetails,
            data: { image: image }
        });
        tabs.push({
            name: _("Used by"),
            renderer: ImageUsedBy,
            data: {
                containers: this.props.imageContainerList !== null ? this.props.imageContainerList[image.Id + image.isSystem.toString()] : null,
                showAll: this.props.showAll,
            }
        });

        const actions = [
            <Button variant="danger"
                    key={image.Id + "delete"}
                    className="btn-delete"
                    aria-label={_("Delete image")}
                    icon={<TrashIcon />}
                    onClick={() => this.deleteImage(image)} />
        ];
        return {
            expandedContent: <ListingPanel
                                colSpan='4'
                                listingActions={actions}
                                tabRenderers={tabs} />,
            columns: columns,
            rowId: image.Id + image.isSystem.toString(),
            props: { key :image.Id + image.isSystem.toString() },
        };
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
            <Button variant="secondary" key="get-new-image-action"
                    onClick={() => this.setState({ showSearchImageModal: true })}
                    className="pull-right"
                    icon={<PlusIcon />}>
                {_("Get new image")}
            </Button>
        ];

        const intermediateOpened = this.state.intermediateOpened;

        let filtered = [];
        if (this.props.images !== null) {
            filtered = Object.keys(this.props.images).filter(id => {
                if (this.props.userServiceAvailable && this.props.systemServiceAvailable && this.props.ownerFilter !== "all") {
                    if (this.props.ownerFilter === "system" && !this.props.images[id].isSystem)
                        return false;
                    if (this.props.ownerFilter !== "system" && this.props.images[id].isSystem)
                        return false;
                }

                const tags = this.props.images[id].RepoTags || [];
                if (!intermediateOpened && tags.length < 1)
                    return false;
                if (this.props.textFilter.length > 0)
                    return tags.some(tag => tag.toLowerCase().indexOf(this.props.textFilter.toLowerCase()) >= 0);
                return true;
            });
        }

        filtered.sort((a, b) => {
            // User images are in front of system ones
            if (this.props.images[a].isSystem !== this.props.images[b].isSystem)
                return this.props.images[a].isSystem ? 1 : -1;
            const name_a = this.props.images[a].RepoTags ? this.props.images[a].RepoTags[0] : "";
            const name_b = this.props.images[b].RepoTags ? this.props.images[b].RepoTags[0] : "";
            if (name_a === "")
                return 1;
            if (name_b === "")
                return -1;
            return name_a > name_b ? 1 : -1;
        });

        const imageRows = filtered.map(id => this.renderRow(this.props.images[id]));

        const interm = this.props.images && Object.keys(this.props.images).some(id => !this.props.images[id].RepoTags);
        let toggleIntermediate = "";
        if (interm) {
            toggleIntermediate = <span className="listing-action">
                <Button variant="link" onClick={() => this.setState({ intermediateOpened: !intermediateOpened })}>
                    {intermediateOpened ? _("Hide intermediate images") : _("Show intermediate images")}</Button>
            </span>;
        }

        return (
            <Card id="containers-images" key="images" className="containers-images">
                <CardHeader>
                    <CardTitle><Text component={TextVariants.h2}>{_("Images")}</Text></CardTitle>
                    <CardActions>{getNewImageAction}</CardActions>
                </CardHeader>
                <CardBody className="contains-list">
                    <ListingTable aria-label={_("Images")}
                                  variant='compact'
                                  emptyCaption={emptyCaption}
                                  columns={columnTitles}
                                  rows={imageRows} />
                    {toggleIntermediate}
                </CardBody>
                {this.state.setImageRemoveErrorModal &&
                    <ForceRemoveModal
                            name={this.state.imageWillDelete.RepoTags[0]}
                            handleCancel={this.handleCancelImageRemoveError}
                            handleForceRemove={this.handleForceRemoveImage}
                            reason={this.imageRemoveErrorMsg} /> }
                {this.state.selectImageDeleteModal &&
                <ImageDeleteModal
                    imageWillDelete={this.state.imageWillDelete}
                    handleCancelImageDeleteModal={this.handleCancelImageDeleteModal}
                    handleRemoveImage={this.handleRemoveImage} /> }
                {this.state.showRunImageModal &&
                <ImageRunModal
                    close={() => this.setState({ showRunImageModal: undefined })}
                    selinuxAvailable={this.props.selinuxAvailable}
                    image={this.state.showRunImageModal} /> }
                {this.state.showSearchImageModal &&
                <ImageSearchModal
                    close={() => this.setState({ showSearchImageModal: false })}
                    downloadImage={this.downloadImage}
                    user={this.props.user}
                    registries={this.props.registries}
                    userServiceAvailable={this.props.userServiceAvailable}
                    systemServiceAvailable={this.props.systemServiceAvailable} /> }
                {this.state.imageDownloadInProgress && <div className='download-in-progress'> {_("Pulling")} {this.state.imageDownloadInProgress}... </div>}
            </Card>
        );
    }
}

export default Images;
