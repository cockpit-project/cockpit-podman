import React from 'react';

import * as client from './client.js';
import {
    Dropdown,
    DropdownPosition,
    DropdownItem,
    KebabToggle
} from '@patternfly/react-core';

import cockpit from 'cockpit';
const _ = cockpit.gettext;

export class PodActions extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
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
    }

    render() {
        const { isOpen } = this.state;
        const pod = this.props.pod;
        const dropdownItems = [];
        // Possible Pod Statuses can be found here https://github.com/containers/podman/blob/master/libpod/define/podstate.go
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
                    {_("Force Stop")}
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

        if (!dropdownItems.length)
            return null;

        return (
            <Dropdown onSelect={this.onSelect}
                      position={DropdownPosition.right}
                      toggle={<KebabToggle onToggle={this.onToggle} id={"pod-" + pod.Name + (pod.isSystem ? "-system" : "-user") + "-action-toggle"} />}
                      isOpen={isOpen}
                      isPlain
                      dropdownItems={dropdownItems} />
        );
    }
}
