import React from 'react';
import { Button, Checkbox, Modal, Stack, StackItem } from '@patternfly/react-core';
import { DialogsContext } from "dialogs.jsx";

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

export class ImageDeleteModal extends React.Component {
    static contextType = DialogsContext;

    constructor(props) {
        super(props);

        const tags = {};
        const repoTags = this.props.imageWillDelete.RepoTags ? this.props.imageWillDelete.RepoTags : [];
        repoTags.sort(sortTags).forEach((x, i) => {
            tags[x] = (i === 0);
        });

        this.state = {
            tags: tags,
        };

        this.onValueChanged = this.onValueChanged.bind(this);
        this.pickAll = this.pickAll.bind(this);
    }

    onValueChanged(item, value) {
        this.setState(prev => {
            const tags = prev.tags;
            tags[item] = value;
            return { tags: tags };
        });
    }

    pickAll() {
        this.setState(prev => {
            const tags = prev.tags;
            Object.keys(tags).forEach(item => { tags[item] = true });
            return { tags: tags };
        });
    }

    handleRemoveImage(tags, all) {
        const Dialogs = this.context;
        const image = this.props.imageWillDelete;

        const handleForceRemoveImage = () => {
            Dialogs.close();
            return client.delImage(image.isSystem, image.Id, true)
                    .catch(ex => {
                        const error = cockpit.format(_("Failed to force remove image $0"), image.RepoTags[0]);
                        this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                        throw ex;
                    });
        };

        Dialogs.close();
        if (all)
            client.delImage(image.isSystem, image.Id, false)
                    .catch(ex => {
                        Dialogs.show(<ForceRemoveModal name={image.RepoTags[0]}
                                                       handleForceRemove={handleForceRemoveImage}
                                                       reason={ex.message} />);
                    });
        else {
            // Call another untag once previous one resolved. Calling all at once can result in undefined behavior
            const tag = tags.shift();
            const i = tag.lastIndexOf(":");
            client.untagImage(image.isSystem, image.Id, tag.substring(0, i), tag.substring(i + 1, tag.length))
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

    render() {
        const Dialogs = this.context;

        const repoTags = Object.keys(this.state.tags).sort(sortTags);
        const checkedTags = repoTags.filter(x => this.state.tags[x]);
        return (
            <Modal isOpen
                   position="top" variant="medium"
                   onClose={Dialogs.close}
                   title={cockpit.format(_("Delete $0"), repoTags ? repoTags[0] : "")}
                   footer={<>
                       <Button id="btn-img-delete" variant="danger" isDisabled={checkedTags.length === 0}
                               onClick={() => this.handleRemoveImage(checkedTags, checkedTags.length === repoTags.length)}>
                           {_("Delete tagged images")}
                       </Button>
                       <Button variant="link" onClick={Dialogs.close}>{_("Cancel")}</Button>
                   </>}
            >
                <Stack hasGutter>
                    { repoTags.length > 1 && <StackItem>{_("Multiple tags exist for this image. Select the tagged images to delete.")}</StackItem> }
                    <StackItem isFilled>
                        { repoTags.map(x => {
                            return (
                                <Checkbox isChecked={checkedTags.indexOf(x) > -1}
                                          id={"delete-" + x}
                                          aria-label={x}
                                          key={x}
                                          label={x}
                                          onChange={checked => this.onValueChanged(x, checked)} />
                            );
                        })}
                    </StackItem>
                </Stack>
                { repoTags.length > 2 && <Button variant="link" onClick={this.pickAll}>{_("select all")}</Button> }
            </Modal>
        );
    }
}
