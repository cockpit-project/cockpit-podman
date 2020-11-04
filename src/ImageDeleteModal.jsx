import React from 'react';
import { Button, Checkbox, Modal } from '@patternfly/react-core';
import cockpit from 'cockpit';

const _ = cockpit.gettext;

function sortTags(a, b) {
    if (a.endsWith(":latest"))
        return -1;
    if (b.endsWith(":latest"))
        return 1;
    return a.localeCompare(b);
}

export class ImageDeleteModal extends React.Component {
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

    render() {
        const repoTags = Object.keys(this.state.tags).sort(sortTags);
        const checkedTags = repoTags.filter(x => this.state.tags[x]);
        return (
            <Modal isOpen
                   position="top" variant="medium"
                   onClose={this.props.handleCancelImageDeleteModal}
                   title={cockpit.format(_("Delete $0"), repoTags ? repoTags[0] : "")}
                   footer={<>
                       <Button id="btn-img-delete" variant="danger" isDisabled={checkedTags.length === 0}
                               onClick={() => this.props.handleRemoveImage(checkedTags, checkedTags.length === repoTags.length)}>
                           {_("Delete tagged images")}
                       </Button>
                       <Button variant="link" onClick={this.props.handleCancelImageDeleteModal}>{_("Cancel")}</Button>
                   </>}
            >
                { repoTags.length > 1 && <p>{_("Multiple tags exist for this image. Select the tagged images to delete.")}</p> }
                <p>
                    { repoTags.map(x => {
                        return (
                            <Checkbox isChecked={checkedTags.indexOf(x) > -1}
                                      aria-label={x}
                                      key={x}
                                      label={x}
                                      onChange={checked => this.onValueChanged(x, checked)} />
                        );
                    })}
                </p>
                { repoTags.length > 2 && <Button variant="link" onClick={this.pickAll}>{_("select all")}</Button> }
            </Modal>
        );
    }
}
