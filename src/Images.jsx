import React from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "@patternfly/react-core/dist/esm/components/Card";
import { Content, ContentVariants } from "@patternfly/react-core/dist/esm/components/Content";
import { DropdownItem } from '@patternfly/react-core/dist/esm/components/Dropdown/index.js';
import { ExpandableSection } from "@patternfly/react-core/dist/esm/components/ExpandableSection";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex";
import { cellWidth, SortByDirection } from '@patternfly/react-table';
import { KebabDropdown } from "cockpit-components-dropdown.jsx";
import { useDialogs, DialogsContext } from "dialogs.jsx";

import cockpit from 'cockpit';
import { ListingPanel } from 'cockpit-components-listing-panel';
import { ListingTable } from "cockpit-components-table";

import { ImageDeleteModal } from './ImageDeleteModal.jsx';
import ImageDetails from './ImageDetails.jsx';
import ImageHistory from './ImageHistory.jsx';
import { ImageRunModal } from './ImageRunModal.jsx';
import { ImageSearchModal } from './ImageSearchModal.jsx';
import PruneUnusedImagesModal from './PruneUnusedImagesModal.jsx';
import * as client from './client.js';
import * as utils from './util.js';

import './Images.css';
import '@patternfly/react-styles/css/utilities/Sizing/sizing.css';

const _ = cockpit.gettext;

class Images extends React.Component {
    static contextType = DialogsContext;

    constructor(props) {
        super(props);
        this.state = {
            intermediateOpened: false,
            isExpanded: false,
            // List of container image names which are being downloaded
            imageDownloadInProgress: [],
            showPruneUnusedImagesModal: false,
        };

        this.downloadImage = this.downloadImage.bind(this);
        this.renderRow = this.renderRow.bind(this);
    }

    downloadImage(imageName, imageTag, con) {
        let pullImageId = imageName;
        if (imageTag)
            pullImageId += ":" + imageTag;

        this.setState(previous => ({ imageDownloadInProgress: [...previous.imageDownloadInProgress, imageName] }));
        client.pullImage(con, pullImageId)
                .then(() => {
                    this.setState(previous => ({ imageDownloadInProgress: previous.imageDownloadInProgress.filter((image) => image != imageName) }));
                })
                .catch(ex => {
                    const error = cockpit.format(_("Failed to download image $0:$1"), imageName, imageTag || "latest");
                    const errorDetail = (
                        <p> {_("Error message")}:
                            <samp>{cockpit.format("$0 $1", ex.message, ex.reason)}</samp>
                        </p>
                    );
                    this.setState(previous => ({ imageDownloadInProgress: previous.imageDownloadInProgress.filter((image) => image != imageName) }));
                    this.props.onAddNotification({ type: 'danger', error, errorDetail });
                });
    }

    onOpenNewImagesDialog = () => {
        const Dialogs = this.context;
        Dialogs.show(<ImageSearchModal downloadImage={this.downloadImage} users={this.props.users} />);
    };

    _con_for = image => this.props.users.find(u => u.uid === image.uid).con;

    onPullAllImages = () => Object.values(this.props.images).forEach(image => {
        // ignore nameless (intermediate) images and the localhost/ pseudo-registry (which cannot be pulled)
        if (image.RepoTags?.find(tag => !tag.startsWith("localhost/")))
            this.downloadImage(image.RepoTags[0], null, this._con_for(image));
        else
            utils.debug("onPullAllImages: ignoring image", image);
    });

    onOpenPruneUnusedImagesDialog = () => {
        this.setState({ showPruneUnusedImagesModal: true });
    };

    getUsedByText(image) {
        const { imageContainerList } = this.props;
        if (imageContainerList === null) {
            return { title: _("unused"), count: 0 };
        }
        const containers = imageContainerList[image.key];
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

                const usedBy = imageContainerList[image.key];
                if (usedBy === undefined) {
                    imageStats.unusedTotal += 1;
                    imageStats.unusedSize += image.Size;
                    unusedImages.push(image);
                }
            });
        }

        return { imageStats, unusedImages };
    };

    renderRow(image) {
        const tabs = [];
        const { title: usedByText, count: usedByCount } = this.getUsedByText(image);

        const user = this.props.users.find(user => user.uid === image.uid);
        cockpit.assert(user, `User not found for image uid ${image.uid}`);

        const columns = [
            { title: utils.image_name(image), header: true, props: { modifier: "breakWord" } },
            { title: (image.uid == 0) ? _("system") : <div><span className="ct-grey-text">{_("user:")} </span>{user.name}</div>, props: { className: "ignore-pixels", modifier: "nowrap" }, sortKey: user.name },
            { title: <utils.RelativeTime time={image.Created * 1000} />, props: { className: "image-created" }, sortKey: image.Created },
            { title: utils.truncate_id(image.Id), props: { className: "image-id" } },
            { title: cockpit.format_bytes(image.Size), props: { className: "ignore-pixels", modifier: "nowrap" }, sortKey: image.Size },
            { title: <span className={usedByCount === 0 ? "ct-grey-text" : ""}>{usedByText}</span>, props: { className: "ignore-pixels", modifier: "nowrap" }, sortKey: usedByCount },
            {
                title: <ImageActions con={user.con}
                                     image={image}
                                     onAddNotification={this.props.onAddNotification}
                                     users={this.props.users}
                                     downloadImage={this.downloadImage} />,
                props: { className: 'pf-v6-c-table__action content-action' }
            },
        ];

        tabs.push({
            name: _("Details"),
            renderer: ImageDetails,
            data: {
                image,
                containers: this.props.imageContainerList !== null ? this.props.imageContainerList[image.key] : null,
                showAll: this.props.showAll,
            }
        });
        tabs.push({
            name: _("History"),
            renderer: ImageHistory,
            data: { con: user.con, image }
        });
        return {
            expandedContent: <ListingPanel
                                colSpan='8'
                                tabRenderers={tabs} />,
            columns,
            props: {
                key: image.key,
                "data-row-id": image.key,
                "data-row-name": `${image.uid === null ? 'user' : image.uid}-${utils.image_name(image)}`
            },
        };
    }

    render() {
        const columnTitles = [
            { title: _("Image"), sortable: true, transforms: [cellWidth(20)] },
            { title: _("Owner"), sortable: true, props: { className: "ignore-pixels" } },
            { title: _("Created"), sortable: true, props: { className: "ignore-pixels", width: 15 } },
            { title: _("ID"), props: { className: "ignore-pixels" } },
            { title: _("Disk space"), sortable: true, props: { className: "ignore-pixels" } },
            { title: _("Used by"), sortable: true, props: { className: "ignore-pixels" } },
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
                if (this.props.ownerFilter !== "all") {
                    if (this.props.ownerFilter === "user")
                        return this.props.images[id].uid === null;
                    return this.props.images[id].uid === this.props.ownerFilter;
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
            if (this.props.images[a].uid !== this.props.images[b].uid)
                return this.props.images[a].uid === 0 ? 1 : -1;
            const name_a = this.props.images[a].RepoTags ? this.props.images[a].RepoTags[0] : "";
            const name_b = this.props.images[b].RepoTags ? this.props.images[b].RepoTags[0] : "";
            if (name_a === "")
                return 1;
            if (name_b === "")
                return -1;
            return name_a > name_b ? 1 : -1;
        });

        const imageRows = filtered.map(id => this.renderRow(this.props.images[id]));

        const sortRows = (rows, direction, idx) => {
            // Image / Owner / Created / ID / Disk space / Used by
            const isNumeric = idx === 2 || idx === 4 || idx === 5;
            const sortedRows = rows.sort((a, b) => {
                const aitem = a.columns[idx].sortKey ?? a.columns[idx].title;
                const bitem = b.columns[idx].sortKey ?? b.columns[idx].title;

                if (isNumeric) {
                    return bitem - aitem;
                } else {
                    return aitem.localeCompare(bitem);
                }
            });
            return direction === SortByDirection.asc ? sortedRows : sortedRows.reverse();
        };

        const interim = this.props.images && Object.keys(this.props.images).some(id => {
            // Intermediate image does not have any tags
            if (this.props.images[id].RepoTags && this.props.images[id].RepoTags.length > 0)
                return false;

            // Only filter by selected user
            if (this.props.ownerFilter !== "all") {
                if (this.props.ownerFilter === "user")
                    return this.props.images[id].uid === null;
                return this.props.images[id].uid === this.props.ownerFilter;
            }

            // Any text filter hides all images
            if (this.props.textFilter.length > 0)
                return false;

            return true;
        });

        let toggleIntermediate = "";
        if (interim) {
            toggleIntermediate = (
                <span className="listing-action">
                    <Button variant="link" onClick={() => this.setState({ intermediateOpened: !intermediateOpened, isExpanded: true })}>
                        {intermediateOpened ? _("Hide intermediate images") : _("Show intermediate images")}</Button>
                </span>
            );
        }
        const cardBody = (
            <>
                <ListingTable aria-label={_("Images")}
                              variant='compact'
                              emptyCaption={emptyCaption}
                              columns={columnTitles}
                              rows={imageRows}
                              sortMethod={sortRows}
                              sortBy={{ index: 1, direction: SortByDirection.asc }} />
                {toggleIntermediate}
            </>
        );

        const { imageStats, unusedImages } = this.calculateStats();
        const imageTitleStats = (
            <>
                <Content component={ContentVariants.div}>
                    {cockpit.format(cockpit.ngettext("$0 image total, $1", "$0 images total, $1", imageStats.imagesTotal), imageStats.imagesTotal, cockpit.format_bytes(imageStats.imagesSize))}
                </Content>
                {imageStats.unusedTotal !== 0 &&
                <Content component={ContentVariants.div}>
                    {cockpit.format(cockpit.ngettext("$0 unused image, $1", "$0 unused images, $1", imageStats.unusedTotal), imageStats.unusedTotal, cockpit.format_bytes(imageStats.unusedSize))}
                </Content>
                }
            </>
        );

        return (
            <Card id="containers-images" key="images" className="containers-images">
                <CardHeader>
                    <Flex flexWrap={{ default: 'nowrap' }} className="pf-v6-u-w-100">
                        <FlexItem grow={{ default: 'grow' }}>
                            <Flex>
                                <CardTitle>
                                    <Content component={ContentVariants.h1} className="containers-images-title">{_("Images")}</Content>
                                </CardTitle>
                                <Flex className="ignore-pixels" style={{ rowGap: "var(--pf-t--global--spacer--xs)" }}>{imageTitleStats}</Flex>
                            </Flex>
                        </FlexItem>
                        <FlexItem>
                            <ImageOverActions handleDownloadNewImage={this.onOpenNewImagesDialog}
                                              handlePullAllImages={this.onPullAllImages}
                                              handlePruneUsedImages={this.onOpenPruneUnusedImagesDialog}
                                              unusedImages={unusedImages} />
                        </FlexItem>
                    </Flex>
                </CardHeader>
                <CardBody>
                    {this.props.images && Object.keys(this.props.images).length
                        ? <ExpandableSection toggleText={this.state.isExpanded ? _("Hide images") : _("Show images")}
                                             onToggle={() => this.setState(prevState => ({ isExpanded: !prevState.isExpanded }))}
                                             isExpanded={this.state.isExpanded}>
                            {cardBody}
                        </ExpandableSection>
                        : cardBody}
                </CardBody>
                {/* The PruneUnusedImagesModal dialog needs to keep
                  * its list of unused images in sync with reality at
                  * all times since the API call will delete whatever
                  * is unused at the exact time of call, and the
                  * dialog better be showing the correct list of
                  * unused images at that time.  Thus, we can't use
                  * Dialog.show for it but include it here in the
                  * DOM. */}
                { this.state.showPruneUnusedImagesModal &&
                    <PruneUnusedImagesModal
                    close={() => this.setState({ showPruneUnusedImagesModal: false })}
                    unusedImages={unusedImages}
                    onAddNotification={this.props.onAddNotification}
                    users={this.props.users} />
                }
                {this.state.imageDownloadInProgress.length > 0 && <CardFooter>
                    <div className='download-in-progress'> {_("Pulling")} {this.state.imageDownloadInProgress.join(', ')}... </div>
                </CardFooter>}
            </Card>
        );
    }
}

const ImageOverActions = ({ handleDownloadNewImage, handlePullAllImages, handlePruneUsedImages, unusedImages }) => {
    const actions = [
        <DropdownItem
            key="download-new-image"
            component="button"
            onClick={() => handleDownloadNewImage()}
        >
            {_("Download new image")}
        </DropdownItem>,
        <DropdownItem
            key="pull-all-images"
            component="button"
            onClick={() => handlePullAllImages()}
        >
            {_("Pull all images")}
        </DropdownItem>,
        <DropdownItem
            key="prune-unused-images"
            id="prune-unused-images-button"
            component="button"
            className="pf-m-danger btn-delete"
            onClick={() => handlePruneUsedImages()}
            isDisabled={unusedImages.length === 0}
            isAriaDisabled={unusedImages.length === 0}
        >
            {_("Prune unused images")}
        </DropdownItem>
    ];

    return (
        <KebabDropdown
              toggleButtonId="image-actions-dropdown"
              position="right"
              dropdownItems={actions}
        />
    );
};

const ImageActions = ({ con, image, onAddNotification, users, downloadImage }) => {
    const Dialogs = useDialogs();

    const runImage = () => {
        Dialogs.show(
            <utils.PodmanInfoContext.Consumer>
                {(podmanInfo) => (
                    <DialogsContext.Consumer>
                        {(Dialogs) => (
                            <ImageRunModal
                              users={users}
                              image={image}
                              onAddNotification={onAddNotification}
                              podmanInfo={podmanInfo}
                              dialogs={Dialogs}
                            />
                        )}
                    </DialogsContext.Consumer>
                )}
            </utils.PodmanInfoContext.Consumer>);
    };

    const pullImage = () => {
        downloadImage(utils.image_name(image), null, con);
    };

    const removeImage = () => {
        Dialogs.show(<ImageDeleteModal con={con}
                                       imageWillDelete={image}
                                       onAddNotification={onAddNotification} />);
    };

    const runImageAction = (
        <Button key={image.Id + "create"}
                className="ct-container-create show-only-when-wide"
                variant='secondary'
                onClick={ e => {
                    e.stopPropagation();
                    runImage();
                }}
                size="sm">
            {_("Create container")}
        </Button>
    );

    const dropdownActions = [
        <DropdownItem key={image.Id + "create-menu"}
                    component="button"
                    className="show-only-when-narrow"
                    onClick={runImage}>
            {_("Create container")}
        </DropdownItem>,
        <DropdownItem key={image.Id + "pull"}
            component="button"
            onClick={pullImage}>
            {_("Pull")}
        </DropdownItem>,
        <DropdownItem key={image.Id + "delete"}
                    component="button"
                    className="pf-m-danger btn-delete"
                    onClick={removeImage}>
            {_("Delete")}
        </DropdownItem>
    ];

    return (
        <>
            {runImageAction}
            <KebabDropdown position="right" dropdownItems={dropdownActions} />
        </>
    );
};

export default Images;
