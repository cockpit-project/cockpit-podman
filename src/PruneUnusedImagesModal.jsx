/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { List, ListItem } from "@patternfly/react-core/dist/esm/components/List";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Flex } from "@patternfly/react-core/dist/esm/layouts/Flex";

import cockpit from 'cockpit';

import * as client from './client.js';
import * as utils from './util.js';

import "@patternfly/patternfly/utilities/Spacing/spacing.css";

const _ = cockpit.gettext;

function ImageOptions({ images, checked, user, handleChange, name, showCheckbox }) {
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
                  label={user.uid === 0
                      ? _("Delete unused system images:")
                      : cockpit.format(_("Delete unused images of user $0:"), user.name)}
                  isChecked={checked}
                  id={name}
                  name={name}
                  onChange={(_, val) => handleChange(val)}
                  aria-owns={listNameId}
                />
            }
            <List id={listNameId}>
                {shownImages.map((image, index) =>
                    <ListItem className="pf-v6-u-ml-md" key={index}>
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

const PruneUnusedImagesModal = ({ close, unusedImages, onAddNotification, users }) => {
    const unusedOwners = users.filter(user => unusedImages.some(image => image.uid === user.uid));
    const [isPruning, setPruning] = useState(false);
    const [deleteOwners, setDeleteOwners] = useState(unusedOwners);

    const handlePruneUnusedImages = () => {
        setPruning(true);

        const actions = deleteOwners.map(owner => client.pruneUnusedImages(owner.con));
        Promise.all(actions).then(close)
                .catch(ex => {
                    const error = _("Failed to prune unused images");
                    onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                    close();
                });
    };

    const showCheckboxes = unusedOwners.length > 1;

    const onCheckChange = (user, checked) => setDeleteOwners(prevState => {
        return checked ? prevState.concat([user]) : prevState.filter(u => u !== user);
    });

    return (
        <Modal isOpen
               onClose={close}
               position="top" variant="medium"
        >
            <ModalHeader title={cockpit.format(_("Prune unused images"))} />
            <ModalBody>
                <Flex flex={{ default: 'column' }}>
                    {unusedOwners.map(user => (
                        <ImageOptions key={user.name}
                                      images={unusedImages.filter(image => image.uid === user.uid)}
                                      name={"deleteImages-" + user.name}
                                      checked={deleteOwners.some(u => u.uid === user.uid)}
                                      handleChange={checked => onCheckChange(user, checked)}
                                      showCheckbox={showCheckboxes}
                                      user={user} />))
                    }
                </Flex>
            </ModalBody>
            <ModalFooter>
                <Button id="btn-img-delete" variant="danger"
                        spinnerAriaValueText={isPruning ? _("Pruning images") : undefined}
                        isLoading={isPruning}
                        isDisabled={deleteOwners.length === 0}
                        onClick={handlePruneUnusedImages}>
                    {isPruning ? _("Pruning images") : _("Prune")}
                </Button>
                <Button variant="link" onClick={() => close()}>{_("Cancel")}</Button>
            </ModalFooter>
        </Modal>
    );
};

export default PruneUnusedImagesModal;
