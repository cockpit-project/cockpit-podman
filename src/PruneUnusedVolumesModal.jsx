import React, { useState } from 'react';
import { Button, Checkbox, Flex, List, ListItem, Modal, } from '@patternfly/react-core';
import cockpit from 'cockpit';

import * as client from './client.js';

import "@patternfly/patternfly/utilities/Spacing/spacing.css";

const _ = cockpit.gettext;

function VolumeOptions({ volumes, checked, isSystem, handleChange, name, showCheckbox }) {
    const [isExpanded, onToggle] = useState(false);
    let shownVolumes = volumes;
    if (!isExpanded) {
        shownVolumes = shownVolumes.slice(0, 5);
    }

    if (shownVolumes.length === 0) {
        return null;
    }
    const listNameId = "list-" + name;

    return (
        <Flex flex={{ default: 'column' }}>
            {showCheckbox &&
                <Checkbox
                  label={isSystem ? _("Delete unused system volumes:") : _("Delete unused user volumes:")}
                  isChecked={checked}
                  id={name}
                  name={name}
                  onChange={handleChange}
                  aria-owns={listNameId}
                />
            }
            <List id={listNameId}>
                {shownVolumes.map((volume, index) =>
                    <ListItem className="pf-u-ml-md" key={index}>
                        {volume.Name}
                    </ListItem>
                )}
                {!isExpanded && volumes.length > 5 &&
                <Button onClick={onToggle} variant="link" isInline>
                    {_("Show more")}
                </Button>
                }
            </List>
        </Flex>
    );
}

class PruneUnusedVolumesModal extends React.Component {
    constructor(props) {
        super(props);
        const isSystem = this.props.userServiceAvailable && this.props.systemServiceAvailable;
        this.state = {
            deleteUserVolumes: true,
            deleteSystemVolumes: isSystem,
            isPruning: false,
        };
    }

    handlePruneUnusedVolumes = () => {
        this.setState({ isPruning: true });

        const actions = [];
        if (this.state.deleteUserVolumes) {
            actions.push(client.pruneUnusedVolumes(false));
        }
        if (this.state.deleteSystemVolumes) {
            actions.push(client.pruneUnusedVolumes(true));
        }
        Promise.all(actions).then(this.props.close)
                .catch(ex => {
                    const error = _("Failed to prune unused volumes");
                    this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                    this.props.close();
                });
    }

    handleChange = (checked, event) => {
        this.setState({ [event.target.name]: checked });
    }

    render() {
        const isSystem = this.props.userServiceAvailable && this.props.systemServiceAvailable;
        const userVolumes = this.props.unusedVolumes.filter(volume => !volume.isSystem);
        const systemVolumes = this.props.unusedVolumes.filter(volume => volume.isSystem);
        const showCheckboxes = userVolumes.length > 0 && systemVolumes.length > 0;
        return (
            <Modal isOpen
                   onClose={this.props.close}
                   position="top" variant="medium"
                   title={cockpit.format(_("Prune unused volumes"))}
                   footer={<>
                       <Button id="btn-img-delete" variant="danger"
                               spinnerAriaValueText={this.state.isPruning ? _("Pruning volumes") : undefined}
                               isLoading={this.state.isPruning}
                               isDisabled={!this.state.deleteUserVolumes && !this.state.deleteSystemVolumes}
                               onClick={this.handlePruneUnusedVolumes}>
                           {this.state.isPruning ? _("Pruning volumes") : _("Prune")}
                       </Button>
                       <Button variant="link" onClick={() => this.props.close()}>{_("Cancel")}</Button>
                   </>}
            >
                <Flex flex={{ default: 'column' }}>
                    {isSystem && <VolumeOptions
                  volumes={systemVolumes}
                  name="deleteSystemVolumes"
                  checked={this.state.deleteSystemVolumes}
                  handleChange={this.handleChange}
                  showCheckbox={showCheckboxes}
                  isSystem
                    />
                    }
                    <VolumeOptions
                  volumes={userVolumes}
                  name="deleteUserVolumes"
                  checked={this.state.deleteUserVolumes}
                  handleChange={this.handleChange}
                  showCheckbox={showCheckboxes}
                  isSystem={false}
                    />
                </Flex>
            </Modal>
        );
    }
}

export default PruneUnusedVolumesModal;
