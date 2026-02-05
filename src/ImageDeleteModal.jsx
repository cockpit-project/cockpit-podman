/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { List, ListItem } from '@patternfly/react-core/dist/esm/components/List';
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack";
import { useDialogs } from "dialogs.jsx";

import cockpit from 'cockpit';

import ForceRemoveModal from './ForceRemoveModal.jsx';
import * as client from './client.js';

const _ = cockpit.gettext;

function sortTags(a, b) {
    if (a.endsWith(":latest"))
        return -1;
    if (b.endsWith(":latest"))
        return 1;
    return a.localeCompare(b);
}

export const ImageDeleteModal = ({ con, imageWillDelete, onAddNotification }) => {
    const Dialogs = useDialogs();
    const repoTags = imageWillDelete.RepoTags ? imageWillDelete.RepoTags : [];
    const isIntermediateImage = repoTags.length === 0;

    const [tags, setTags] = useState(repoTags.sort(sortTags).reduce((acc, item, i) => {
        acc[item] = (i === 0);
        return acc;
    }, {}));

    const checkedTags = Object.keys(tags).sort(sortTags)
            .filter(x => tags[x]);

    const onValueChanged = (item, value) => {
        setTags(prevState => ({
            ...prevState,
            [item]: value,
        }));
    };

    const handleRemoveImage = (tags, all, close_dialog = true) => {
        const handleForceRemoveImage = () => {
            Dialogs.close();
            return client.delImage(con, imageWillDelete.Id, true)
                    .catch(ex => {
                        const error = cockpit.format(_("Failed to force remove image $0"), imageWillDelete.RepoTags[0]);
                        onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                    });
        };

        if (close_dialog) {
            Dialogs.close();
        }

        if (all) {
            client.delImage(con, imageWillDelete.Id, false)
                    .catch(ex => {
                        Dialogs.show(<ForceRemoveModal name={isIntermediateImage ? _("intermediate image") : repoTags[0]}
                                                       handleForceRemove={handleForceRemoveImage}
                                                       reason={ex.message} />);
                    });
        } else {
            // Call another untag once previous one resolved. Calling all at once can result in undefined behavior
            const tag = tags.shift();
            const i = tag.lastIndexOf(":");
            client.untagImage(con, imageWillDelete.Id, tag.substring(0, i), tag.substring(i + 1, tag.length))
                    .then(() => {
                        if (tags.length > 0)
                            handleRemoveImage(tags, all, false);
                    })
                    .catch(ex => {
                        const error = cockpit.format(_("Failed to remove image $0"), tag);
                        onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                    });
        }
    };

    const imageName = repoTags[0]?.split(":")[0].split("/").at(-1) ?? _("intermediate");

    let isAllSelected = null;
    if (checkedTags.length === repoTags.length)
        isAllSelected = true;
    else if (checkedTags.length === 0)
        isAllSelected = false;

    return (
        <Modal isOpen
                 position="top" variant="medium"
                 onClose={Dialogs.close}
        >
            <ModalHeader title={cockpit.format(_("Delete $0 image?"), imageName)}
                titleIconVariant="warning"
            />
            <ModalBody>
                <Stack hasGutter>
                    { repoTags.length > 1 && <StackItem>{_("Multiple tags exist for this image. Select the tagged images to delete.")}</StackItem> }
                    <StackItem isFilled>
                        {repoTags.length > 1 && <Checkbox isChecked={isAllSelected} id='delete-all' label={_("All")} aria-label='All'
                            onChange={(_event, checked) => repoTags.forEach(item => onValueChanged(item, checked))}
                            body={
                                repoTags.map(x => (
                                    <Checkbox isChecked={checkedTags.indexOf(x) > -1}
                                                id={"delete-" + x}
                                                aria-label={x}
                                                key={x}
                                                label={x}
                                                onChange={(_event, checked) => onValueChanged(x, checked)} />
                                ))
                            } />}
                        {repoTags.length === 1 && <List><ListItem>{repoTags[0]}</ListItem></List>}
                    </StackItem>
                </Stack>
            </ModalBody>
            <ModalFooter>
                <Button id="btn-img-delete" variant="danger" isDisabled={!isIntermediateImage && checkedTags.length === 0}
                        onClick={() => handleRemoveImage(checkedTags, checkedTags.length === repoTags.length)}>
                    {isIntermediateImage ? _("Delete image") : _("Delete tagged images")}
                </Button>
                <Button variant="link" onClick={Dialogs.close}>{_("Cancel")}</Button>
            </ModalFooter>
        </Modal>
    );
};
