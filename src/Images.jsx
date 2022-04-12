import React, { useState } from 'react';
import {
    Button,
    Card, CardBody, CardHeader, CardFooter,
    Dropdown, DropdownItem,
    Flex, FlexItem,
    ExpandableSection,
    KebabToggle,
    Text, TextVariants
} from '@patternfly/react-core';
import { cellWidth } from '@patternfly/react-table';

import cockpit from 'cockpit';
import { ListingTable } from "cockpit-components-table.jsx";
import { ListingPanel } from 'cockpit-components-listing-panel.jsx';
import ImageDetails from './ImageDetails.jsx';
import { ImageRunModal } from './ImageRunModal.jsx';
import { ImageSearchModal } from './ImageSearchModal.jsx';
import { ImageDeleteModal } from './ImageDeleteModal.jsx';
import PruneUnusedImagesModal from './PruneUnusedImagesModal.jsx';
import ForceRemoveModal from './ForceRemoveModal.jsx';
import * as client from './client.js';
import * as utils from './util.js';

import './Images.css';
import '@patternfly/react-styles/css/utilities/Sizing/sizing.css';

const _ = cockpit.gettext;

class Images extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            intermediateOpened: false,
            isExpanded: false,
        };

        this.downloadImage = this.downloadImage.bind(this);
        this.renderRow = this.renderRow.bind(this);
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

    onOpenNewImagesDialog = () => {
        this.setState({ showSearchImageModal: true });
    }

    onOpenPruneUnusedImagesDialog = () => {
        this.setState({ showPruneUnusedImagesModal: true });
    }

    getUsedByText(image) {
        const { imageContainerList } = this.props;
        if (imageContainerList === null) {
            return { title: _("unused"), count: 0 };
        }
        const containers = imageContainerList[image.Id + image.isSystem.toString()];
        if (containers !== undefined) {
            const title = cockpit.format(cockpit.ngettext("$0 container", "$0 containers", containers.length), containers.length);
            return { title, count: containers.length };
        } else {
            return { title: _("unused"), count: 0 };
        }
    }

    calculateStats = () => {
        const { images, imageContainerList } = this.props;
        const unusedImages = [];
        const imageStats = {
            imagesTotal: 0,
            imagesSize: 0,
            unusedTotal: 0,
            unusedSize: 0,
        };

        if (imageContainerList === null) {
            return { imageStats, unusedImages };
        }

        if (images !== null) {
            Object.keys(images).forEach(id => {
                const image = images[id];
                imageStats.imagesTotal += 1;
                imageStats.imagesSize += image.Size;

                const usedBy = imageContainerList[image.Id + image.isSystem.toString()];
                if (usedBy === undefined) {
                    imageStats.unusedTotal += 1;
                    imageStats.unusedSize += image.Size;
                    unusedImages.push(image);
                }
            });
        }

        return { imageStats, unusedImages };
    }

    renderRow(image) {
        const tabs = [];
        const { title: usedByText, count: usedByCount } = this.getUsedByText(image);

        const columns = [
            { title: utils.image_name(image), header: true, props: { modifier: "breakWord" } },
            { title: image.isSystem ? _("system") : <div><span className="ct-grey-text">{_("user:")} </span>{this.props.user}</div>, props: { modifier: "nowrap" } },
            utils.localize_time(image.Created),
            utils.truncate_id(image.Id),
            { title: cockpit.format_bytes(image.Size, 1000), props: { modifier: "nowrap" } },
            { title: <span className={usedByCount === 0 ? "ct-grey-text" : ""}>{usedByText}</span>, props: { modifier: "nowrap" } },
            {
                title: <ImageActions image={image} onAddNotification={this.props.onAddNotification} selinuxAvailable={this.props.selinuxAvailable}
                                     registries={this.props.registries} user={this.props.user}
                                     userServiceAvailable={this.props.userServiceAvailable}
                                     systemServiceAvailable={this.props.systemServiceAvailable}
                                     podmanRestartAvailable={this.props.podmanRestartAvailable} />,
                props: { className: 'pf-c-table__action content-action' }
            },
        ];

        tabs.push({
            name: _("Details"),
            renderer: ImageDetails,
            data: {
                image: image,
                containers: this.props.imageContainerList !== null ? this.props.imageContainerList[image.Id + image.isSystem.toString()] : null,
                showAll: this.props.showAll,
            }
        });
        return {
            expandedContent: <ListingPanel
                                colSpan='8'
                                tabRenderers={tabs} />,
            columns: columns,
            props: {
                key :image.Id + image.isSystem.toString(),
                "data-row-id": image.Id + image.isSystem.toString(),
            },
        };
    }

    render() {
        const columnTitles = [
            { title: _("Image"), transforms: [cellWidth(20)] },
            _("Owner"),
            _("Created"),
            _("ID"),
            _("Disk space"),
            _("Used by")
        ];
        let emptyCaption = _("No images");
        if (this.props.images === null)
            emptyCaption = "Loading...";
        else if (this.props.textFilter.length > 0)
            emptyCaption = _("No images that match the current filter");

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

        const interim = this.props.images && Object.keys(this.props.images).some(id => {
            // Intermediate image does not have any tags
            if (this.props.images[id].RepoTags && this.props.images[id].RepoTags.length > 0)
                return false;

            // Only filter by selected user
            if (this.props.userServiceAvailable && this.props.systemServiceAvailable && this.props.ownerFilter !== "all") {
                if (this.props.ownerFilter === "system" && !this.props.images[id].isSystem)
                    return false;
                if (this.props.ownerFilter !== "system" && this.props.images[id].isSystem)
                    return false;
            }

            // Any text filter hides all images
            if (this.props.textFilter.length > 0)
                return false;

            return true;
        });

        let toggleIntermediate = "";
        if (interim) {
            toggleIntermediate = <span className="listing-action">
                <Button variant="link" onClick={() => this.setState({ intermediateOpened: !intermediateOpened, isExpanded: true })}>
                    {intermediateOpened ? _("Hide intermediate images") : _("Show intermediate images")}</Button>
            </span>;
        }
        const cardBody = (
            <>
                <ListingTable aria-label={_("Images")}
                              variant='compact'
                              emptyCaption={emptyCaption}
                              columns={columnTitles}
                              rows={imageRows} />
                {toggleIntermediate}
            </>
        );

        const { imageStats, unusedImages } = this.calculateStats();
        const imageTitleStats = (
            <>
                <Text component={TextVariants.h5}>
                    {cockpit.format(cockpit.ngettext("$0 image total, $1", "$0 images total, $1", imageStats.imagesTotal), imageStats.imagesTotal, cockpit.format_bytes(imageStats.imagesSize, 1000))}
                </Text>
                {imageStats.unusedTotal !== 0 &&
                <Text component={TextVariants.h5}>
                    {cockpit.format(cockpit.ngettext("$0 unused image, $1", "$0 unused images, $1", imageStats.unusedTotal), imageStats.unusedTotal, cockpit.format_bytes(imageStats.unusedSize, 1000))}
                </Text>
                }
            </>
        );

        return (
            <Card id="containers-images" key="images" className="containers-images">
                <CardHeader>
                    <Flex flexWrap={{ default: 'nowrap' }} className="pf-u-w-100">
                        <FlexItem grow={{ default: 'grow' }}>
                            <Flex>
                                <Text className="images-title" component={TextVariants.h3}>{_("Images")}</Text>
                                <Flex style={{ rowGap: "var(--pf-global--spacer--xs)" }}>{imageTitleStats}</Flex>
                            </Flex>
                        </FlexItem>
                        <FlexItem>
                            <ImageOverActions handleDownloadNewImage={this.onOpenNewImagesDialog}
                                              handlePruneUsedImages={this.onOpenPruneUnusedImagesDialog}
                                              unusedImages={unusedImages} />
                        </FlexItem>
                    </Flex>
                </CardHeader>
                <CardBody>
                    {filtered.length
                        ? <ExpandableSection toggleText={this.state.isExpanded ? _("Hide images") : _("Show images")}
                                             onToggle={() => this.setState({ isExpanded: !this.state.isExpanded })}
                                             isExpanded={this.state.isExpanded}>
                            {cardBody}
                        </ExpandableSection>
                        : cardBody}
                </CardBody>
                {this.state.showSearchImageModal &&
                <ImageSearchModal
                    close={() => this.setState({ showSearchImageModal: false })}
                    downloadImage={this.downloadImage}
                    user={this.props.user}
                    registries={this.props.registries}
                    userServiceAvailable={this.props.userServiceAvailable}
                    systemServiceAvailable={this.props.systemServiceAvailable} /> }
                {this.state.showPruneUnusedImagesModal &&
                <PruneUnusedImagesModal
                  close={() => this.setState({ showPruneUnusedImagesModal: false })}
                  unusedImages={unusedImages}
                  onAddNotification={this.props.onAddNotification}
                  userServiceAvailable={this.props.userServiceAvailable}
                  systemServiceAvailable={this.props.systemServiceAvailable} /> }
                {this.state.imageDownloadInProgress && <CardFooter>
                    <div className='download-in-progress'> {_("Pulling")} {this.state.imageDownloadInProgress}... </div>
                </CardFooter>}
            </Card>
        );
    }
}

const ImageOverActions = ({ handleDownloadNewImage, handlePruneUsedImages, unusedImages }) => {
    const [isActionsKebabOpen, setIsActionsKebabOpen] = useState(false);

    return (
        <Dropdown toggle={<KebabToggle onToggle={() => setIsActionsKebabOpen(!isActionsKebabOpen)} id="image-actions-dropdown" />}
                  isOpen={isActionsKebabOpen}
                  isPlain
                  position="right"
                  dropdownItems={[
                      <DropdownItem key="download-new-image"
                                    component="button"
                                    onClick={handleDownloadNewImage}>
                          {_("Download new image")}
                      </DropdownItem>,
                      <DropdownItem key="prune-unused-images"
                                    id="prune-unused-images-button"
                                    component="button"
                                    className="pf-m-danger btn-delete"
                                    onClick={handlePruneUsedImages}
                                    isDisabled={unusedImages.length === 0}
                                    isAriaDisabled={unusedImages.length === 0}>
                          {_("Prune unused images")}
                      </DropdownItem>,
                  ]} />
    );
};

const ImageActions = ({ image, onAddNotification, registries, selinuxAvailable, user, systemServiceAvailable, userServiceAvailable, podmanRestartAvailable }) => {
    const [showRunImageModal, setShowImageRunModal] = useState(false);
    const [showImageDeleteModal, setShowImageDeleteModal] = useState(false);
    const [showImageDeleteErrorModal, setShowImageDeleteErrorModal] = useState(false);
    const [imageDeleteErrorMsg, setImageDeleteErrorMsg] = useState();
    const [isActionsKebabOpen, setIsActionsKebabOpen] = useState(false);

    const handleRemoveImage = (tags, all) => {
        setShowImageDeleteModal(false);
        if (all)
            client.delImage(image.isSystem, image.Id, false)
                    .catch(ex => {
                        setImageDeleteErrorMsg(ex.message);
                        setShowImageDeleteErrorModal(true);
                    });
        else {
            // Call another untag once previous one resolved. Calling all at once can result in undefined behavior
            const tag = tags.shift();
            const i = tag.lastIndexOf(":");
            client.untagImage(image.isSystem, image.Id, tag.substring(0, i), tag.substring(i + 1, tag.length))
                    .then(() => {
                        if (tags.length > 0)
                            handleRemoveImage(tags, all);
                    })
                    .catch(ex => {
                        const error = cockpit.format(_("Failed to remove image $0"), tag);
                        onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                    });
        }
    };

    const handleForceRemoveImage = () => {
        return client.delImage(image.isSystem, image.Id, true)
                .then(reply => setShowImageDeleteErrorModal(false))
                .catch(ex => {
                    const error = cockpit.format(_("Failed to force remove image $0"), image.RepoTags[0]);
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                    throw ex;
                });
    };

    const runImage = (
        <Button key={image.Id + "create"}
                className="ct-container-create show-only-when-wide"
                variant='secondary'
                onClick={ e => {
                    e.stopPropagation();
                    setShowImageRunModal(true);
                }}
                isSmall
                data-image={image.Id}>
            {_("Create container")}
        </Button>
    );

    const extraActions = (
        <Dropdown toggle={<KebabToggle onToggle={() => setIsActionsKebabOpen(!isActionsKebabOpen)} />}
                  isOpen={isActionsKebabOpen}
                  isPlain
                  position="right"
                  dropdownItems={[
                      <DropdownItem key={image.Id + "create-menu"}
                                    component="button"
                                    className="show-only-when-narrow"
                                    onClick={() => setShowImageRunModal(true)}>
                          {_("Create container")}
                      </DropdownItem>,
                      <DropdownItem key={image.Id + "delete"}
                                    component="button"
                                    className="pf-m-danger btn-delete"
                                    onClick={() => setShowImageDeleteModal(true)}>
                          {_("Delete")}
                      </DropdownItem>
                  ]} />
    );

    return (
        <>
            {runImage}
            {extraActions}
            {showImageDeleteErrorModal &&
                <ForceRemoveModal
                        name={image.RepoTags[0]}
                        handleCancel={() => setShowImageDeleteErrorModal(false)}
                        handleForceRemove={handleForceRemoveImage}
                        reason={imageDeleteErrorMsg} /> }
            {showImageDeleteModal &&
            <ImageDeleteModal
                imageWillDelete={image}
                handleCancelImageDeleteModal={() => setShowImageDeleteModal(false)}
                handleRemoveImage={handleRemoveImage} /> }
            {showRunImageModal &&
            <ImageRunModal
                close={() => setShowImageRunModal(false)}
                registries={registries}
                selinuxAvailable={selinuxAvailable}
                podmanRestartAvailable={podmanRestartAvailable}
                systemServiceAvailable={systemServiceAvailable}
                userServiceAvailable={userServiceAvailable}
                user={user}
                image={image}
                onAddNotification={onAddNotification}
            /> }
        </>
    );
};

export default Images;
