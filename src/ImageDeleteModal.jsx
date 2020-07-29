import React from 'react';
import { Modal } from 'patternfly-react';
import { Button } from '@patternfly/react-core';
import cockpit from 'cockpit';

const _ = cockpit.gettext;

export class ImageDeleteModal extends React.Component {
    constructor(props) {
        super(props);

        const tags = {};
        const repoTags = this.props.imageWillDelete.RepoTags ? this.props.imageWillDelete.RepoTags : [];
        repoTags.forEach((x, i) => {
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
        const repoTag = this.props.imageWillDelete.RepoTags ? this.props.imageWillDelete.RepoTags[0] : "";
        const repoTags = Object.keys(this.state.tags);
        const checkedTags = repoTags.filter(x => this.state.tags[x]);
        return (
            <Modal show>
                <Modal.Header>
                    <Modal.Title>{cockpit.format(_("Delete $0"), repoTag)}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    { repoTags.length > 1 && <p>{_("Multiple tags exist for this image. Select the tagged images to delete.")}</p> }
                    <p>
                        { repoTags.map(x => {
                            return (<label key={x} className="checkbox">
                                <input type="checkbox"
                                       checked={checkedTags.indexOf(x) > -1}
                                       onChange={e => this.onValueChanged(x, e.target.checked)} />
                                {x}
                            </label>);
                        })}
                    </p>
                    { repoTags.length > 2 && <Button variant="link" onClick={this.pickAll}>{_("select all")}</Button> }
                </Modal.Body>
                <Modal.Footer>
                    <Button id="btn-img-delete" variant="danger" isDisabled={checkedTags.length === 0}
                            onClick={() => this.props.handleRemoveImage(checkedTags, checkedTags.length === repoTags.length)}>
                        {_("Delete tagged images")}
                    </Button>
                    <Button variant="link" onClick={this.props.handleCancelImageDeleteModal}>{_("Cancel")}</Button>
                </Modal.Footer>
            </Modal>
        );
    }
}
