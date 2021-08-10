import React, { useState } from 'react';
import {
    Button,
    Card, CardBody, CardHeader, CardTitle, CardActions, CardFooter,
    Dropdown, DropdownItem,
    Flex,
    ExpandableSection,
    KebabToggle,
    Text, TextVariants
} from '@patternfly/react-core';
import { PlusIcon } from '@patternfly/react-icons';

import cockpit from 'cockpit';
import { ListingTable } from "cockpit-components-table.jsx";
import { ListingPanel } from 'cockpit-components-listing-panel.jsx';
import ImageDetails from './ImageDetails.jsx';
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

    renderRow(image) {
        const tabs = [];

        const columns = [
            { title: image.RepoTags ? image.RepoTags[0] : "<none>:<none>", header: true },
            utils.localize_time(image.Created),
            cockpit.format_bytes(image.Size),
            image.isSystem ? _("system") : this.props.user,
            {
                title: <ImageActions image={image} onAddNotification={this.props.onAddNotification} selinuxAvailable={this.props.selinuxAvailable} />,
                props: { className: 'pf-c-table__action' }
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
                                colSpan='4'
                                tabRenderers={tabs} />,
            columns: columns,
            props: {
                key :image.Id + image.isSystem.toString(),
                "data-row-id": image.Id + image.isSystem.toString(),
            },
        };
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

        return (
            <Card id="containers-images" key="images" className="containers-images">
                <CardHeader>
                    <CardTitle><Text component={TextVariants.h2}>{_("Images")}</Text></CardTitle>
                    <CardActions>{getNewImageAction}</CardActions>
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
                {this.state.imageDownloadInProgress && <CardFooter>
                    <div className='download-in-progress'> {_("Pulling")} {this.state.imageDownloadInProgress}... </div>
                </CardFooter>}
            </Card>
        );
    }
}

const ImageActions = ({ image, onAddNotification, selinuxAvailable }) => {
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
                });
    };

    const runImage = (
        <Button key={image.Id + "create"}
                className="ct-container-create"
                variant='secondary'
                onClick={ e => {
                    e.stopPropagation();
                    setShowImageRunModal(true);
                }}
                isSmall
                data-image={image.Id}>
            {_("Run image")}
        </Button>
    );

    const extraActions = (
        <Dropdown toggle={<KebabToggle onToggle={() => setIsActionsKebabOpen(!isActionsKebabOpen)} />}
                  isOpen={isActionsKebabOpen}
                  isPlain
                  dropdownItems={[
                      <DropdownItem key={image.Id + "delete"}
                                    component="button"
                                    className="pf-m-danger btn-delete"
                                    onClick={() => setShowImageDeleteModal(true)}>
                          {_("Delete")}
                      </DropdownItem>
                  ]} />
    );

    return (
        <Flex flexWrap={{ default: 'nowrap' }}>
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
                selinuxAvailable={selinuxAvailable}
                image={image} /> }
        </Flex>
    );
};

export default Images;
