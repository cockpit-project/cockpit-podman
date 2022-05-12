import React from 'react';

import * as client from './client.js';
import {
    Button, Alert, Modal,
    Dropdown, DropdownPosition, DropdownItem, DropdownSeparator,
    KebabToggle, List, ListItem,
    Stack,
} from '@patternfly/react-core';

import cockpit from 'cockpit';

const _ = cockpit.gettext;

export class PodActions extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            deleteModalOpen: false,
            deleteOperationInProgress: false,
            isOpen: false
        };
        this.onToggle = isOpen => {
            this.setState({
                isOpen
            });
        };
        this.onSelect = event => {
            this.setState({
                isOpen: !this.state.isOpen
            });
        };
        this.handlePodDelete = (force = false) => {
            const pod = props.pod;
            client.delPod(pod.isSystem, pod.Id, force)
                    .catch(ex => {
                        if (!force)
                            this.setState({ deleteModalOpen: false, forceDeleteModalOpen: true });
                        this.setState({ deleteError: ex.message });
                    });
        };
    }

    render() {
        const { isOpen } = this.state;
        const pod = this.props.pod;
        const dropdownItems = [];
        // Possible Pod Statuses can be found here https://github.com/containers/podman/blob/main/libpod/define/podstate.go
        if (pod.Status == "Running" || pod.Status == "Paused") {
            dropdownItems.push(
                <DropdownItem key="action-stop"
                              className="pod-action-stop"
                              onClick={() =>
                                  client.postPod(pod.isSystem, "stop", pod.Id, {})
                                          .catch(ex => {
                                              const error = cockpit.format(_("Failed to stop pod $0"), pod.Name);
                                              this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                                          })}
                              component="button">
                    {_("Stop")}
                </DropdownItem>,
                <DropdownItem key="action-force-stop"
                              className="pod-action-force-stop"
                              onClick={() =>
                                  client.postPod(pod.isSystem, "stop", pod.Id, { t: 0 })
                                          .catch(ex => {
                                              const error = cockpit.format(_("Failed to force stop pod $0"), pod.Name);
                                              this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                                          })}
                              component="button">
                    {_("Force stop")}
                </DropdownItem>,
                <DropdownItem key="action-restart"
                              className="pod-action-restart"
                              onClick={() =>
                                  client.postPod(pod.isSystem, "restart", pod.Id, {})
                                          .catch(ex => {
                                              const error = cockpit.format(_("Failed to restart pod $0"), pod.Name);
                                              this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                                          })}
                              component="button">
                    {_("Restart")}
                </DropdownItem>,
                <DropdownItem key="action-force-restart"
                              className="pod-action-force-restart"
                              onClick={() =>
                                  client.postPod(pod.isSystem, "restart", pod.Id, { t: 0 })
                                          .catch(ex => {
                                              const error = cockpit.format(_("Failed to force restart pod $0"), pod.Name);
                                              this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                                          })}
                              component="button">
                    {_("Force restart")}
                </DropdownItem>,
            );
        }
        if (pod.Status == "Created" || pod.Status == "Exited" || pod.Status == "Stopped") {
            dropdownItems.push(
                <DropdownItem key="action-start"
                              className="pod-action-start"
                              onClick={() =>
                                  client.postPod(pod.isSystem, "start", pod.Id, {})
                                          .catch(ex => {
                                              const error = cockpit.format(_("Failed to start pod $0"), pod.Name);
                                              this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                                          })}
                              component="button">
                    {_("Start")}
                </DropdownItem>,
            );
        }
        if (pod.Status == "Paused") {
            dropdownItems.push(
                <DropdownItem key="action-unpause"
                              className="pod-action-unpause"
                              onClick={() =>
                                  client.postPod(pod.isSystem, "unpause", pod.Id, {})
                                          .catch(ex => {
                                              const error = cockpit.format(_("Failed to resume pod $0"), pod.Name);
                                              this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                                          })}
                              component="button">
                    {_("Resume")}
                </DropdownItem>,
            );
        }
        if (pod.Status == "Running") {
            dropdownItems.push(
                <DropdownItem key="action-pause"
                              className="pod-action-pause"
                              onClick={() =>
                                  client.postPod(pod.isSystem, "pause", pod.Id, {})
                                          .catch(ex => {
                                              const error = cockpit.format(_("Failed to pause pod $0"), pod.Name);
                                              this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                                          })}
                              component="button">
                    {_("Pause")}
                </DropdownItem>,
            );
        }

        if (dropdownItems.length > 1) {
            dropdownItems.push(<DropdownSeparator key="separator-1" />);
        }
        dropdownItems.push(
            <DropdownItem key="action-delete"
                          className="pod-action-delete pf-m-danger"
                          onClick={() => this.setState({ deleteModalOpen: true })}
                          component="button">
                {_("Delete")}
            </DropdownItem>,
        );

        if (!dropdownItems.length)
            return null;

        const containers = (pod.Containers || []).filter(ct => ct.Id !== pod.InfraId);

        return (
            <>
                <Dropdown onSelect={this.onSelect}
                          position={DropdownPosition.right}
                          toggle={<KebabToggle onToggle={this.onToggle} id={"pod-" + pod.Name + (pod.isSystem ? "-system" : "-user") + "-action-toggle"} />}
                          isOpen={isOpen}
                          isPlain
                          dropdownItems={dropdownItems} />
                {(this.state.deleteModalOpen || this.state.forceDeleteModalOpen) && <Modal isOpen
                    position="top" variant="medium"
                    titleIconVariant="warning"
                    title={this.state.forceDeleteModalOpen ? cockpit.format(_("Confirm force deletion of pod $0"), pod.Name) : cockpit.format(_("Confirm deletion of pod $0"), pod.Name)}
                    onClose={() => this.setState({ deleteModalOpen: false, forceDeleteModalOpen: false, deleteError: false })}
                    footer={<>
                        <Button variant="danger" onClick={() => this.handlePodDelete(this.state.forceDeleteModalOpen)}>{this.state.forceDeleteModalOpen ? _("Force delete") : _("Delete")}</Button>{' '}
                        <Button variant="link" onClick={() => this.setState({ deleteModalOpen: false, forceDeleteModalOpen: false, deleteError: false })}>{_("Cancel")}</Button>
                    </>}
                >
                    {containers.length > 0 && <Stack hasGutter>
                        {this.state.deleteError && <Alert variant="danger" isInline title={_("An error occurred")}>{this.state.deleteError}</Alert>}
                        <p>{_("Deleting this pod will remove the following containers:")}</p>
                        <List>
                            {containers.map(container => <ListItem key={container.Names}>{container.Names}</ListItem>)}
                        </List>
                    </Stack>}
                </Modal>}
            </>
        );
    }
}
