import React, { useState } from 'react';
import { Button, Checkbox, Flex, List, ListItem, Modal, } from '@patternfly/react-core';
import cockpit from 'cockpit';

import * as client from './client.js';
import * as utils from './util.js';

import "@patternfly/patternfly/utilities/Spacing/spacing.css";

const _ = cockpit.gettext;

function ImageOptions({ images, checked, isSystem, handleChange, name, showCheckbox }) {
    const [isExpanded, onToggle] = useState(false);
    let shownImages = images;
    if (!isExpanded) {
        shownImages = shownImages.slice(0, 5);
    }

    if (shownImages.length === 0) {
        return null;
    }
    const listNameId = "list-" + name;

    return (
        <Flex flex={{ default: 'column' }}>
            {showCheckbox &&
                <Checkbox
                  label={isSystem ? _("Delete unused system images:") : _("Delete unused user images:")}
                  isChecked={checked}
                  id={name}
                  name={name}
                  onChange={handleChange}
                  aria-owns={listNameId}
                />
            }
            <List id={listNameId}>
                {shownImages.map((image, index) =>
                    <ListItem className="pf-u-ml-md" key={index}>
                        {utils.image_name(image)}
                    </ListItem>
                )}
                {!isExpanded && images.length > 5 &&
                <Button onClick={onToggle} variant="link" isInline>
                    {_("Show more")}
                </Button>
                }
            </List>
        </Flex>
    );
}

class PruneUnusedImagesModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            deleteUserImages: this.props.userServiceAvailable !== null && this.props.userServiceAvailable,
            deleteSystemImages: this.props.systemServiceAvailable,
            isPruning: false,
        };
    }

    handlePruneUnusedImages = () => {
        this.setState({ isPruning: true });

        const actions = [];
        if (this.state.deleteUserImages) {
            actions.push(client.pruneUnusedImages(false));
        }
        if (this.state.deleteSystemImages) {
            actions.push(client.pruneUnusedImages(true));
        }
        Promise.all(actions).then(this.props.close)
                .catch(ex => {
                    const error = _("Failed to prune unused images");
                    this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                    this.props.close();
                });
    }

    handleChange = (checked, event) => {
        this.setState({ [event.target.name]: checked });
    }

    render() {
        const isSystem = this.props.systemServiceAvailable;
        const userImages = this.props.unusedImages.filter(image => !image.isSystem);
        const systemImages = this.props.unusedImages.filter(image => image.isSystem);
        const showCheckboxes = userImages.length > 0 && systemImages.length > 0;
        return (
            <Modal isOpen
                   onClose={this.props.close}
                   position="top" variant="medium"
                   title={cockpit.format(_("Prune unused images"))}
                   footer={<>
                       <Button id="btn-img-delete" variant="danger"
                               spinnerAriaValueText={this.state.isPruning ? _("Pruning images") : undefined}
                               isLoading={this.state.isPruning}
                               isDisabled={!this.state.deleteUserImages && !this.state.deleteSystemImages}
                               onClick={this.handlePruneUnusedImages}>
                           {this.state.isPruning ? _("Pruning images") : _("Prune")}
                       </Button>
                       <Button variant="link" onClick={() => this.props.close()}>{_("Cancel")}</Button>
                   </>}
            >
                <Flex flex={{ default: 'column' }}>
                    {isSystem && <ImageOptions
                  images={systemImages}
                  name="deleteSystemImages"
                  checked={this.state.deleteSystemImages}
                  handleChange={this.handleChange}
                  showCheckbox={showCheckboxes}
                  isSystem
                    />
                    }
                    <ImageOptions
                  images={userImages}
                  name="deleteUserImages"
                  checked={this.state.deleteUserImages}
                  handleChange={this.handleChange}
                  showCheckbox={showCheckboxes}
                  isSystem={false}
                    />
                </Flex>
            </Modal>
        );
    }
}

export default PruneUnusedImagesModal;
