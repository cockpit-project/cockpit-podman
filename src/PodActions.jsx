import React, { useState } from 'react';

import { Alert } from "@patternfly/react-core/dist/esm/components/Alert";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Divider } from '@patternfly/react-core/dist/esm/components/Divider/index.js';
import { DropdownItem } from '@patternfly/react-core/dist/esm/components/Dropdown/index.js';
import { List, ListItem } from "@patternfly/react-core/dist/esm/components/List";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Stack } from "@patternfly/react-core/dist/esm/layouts/Stack";
import { KebabDropdown } from "cockpit-components-dropdown.jsx";
import { useDialogs } from "dialogs.jsx";

import cockpit from 'cockpit';

import * as client from './client.js';

const _ = cockpit.gettext;

const PodDeleteModal = ({ con, pod }) => {
    const Dialogs = useDialogs();
    const [deleteError, setDeleteError] = useState(null);
    const [force, setForce] = useState(false);

    const containers = (pod.Containers || []).filter(ct => ct.Id !== pod.InfraId);

    function handlePodDelete() {
        client.delPod(con, pod.Id, force)
                .then(() => {
                    Dialogs.close();
                })
                .catch(ex => {
                    setDeleteError(ex.message);
                    setForce(true);
                });
    }

    return (
        <Modal isOpen
                  position="top" variant="medium"
                  onClose={Dialogs.close}
        >
            <ModalHeader titleIconVariant="warning"
                  title={force
                      ? cockpit.format(_("Force delete pod $0?"), pod.Name)
                      : cockpit.format(_("Delete pod $0?"), pod.Name)}
            />
            <ModalBody>
                {deleteError &&
                <Alert variant="danger" isInline title={_("An error occurred")}>{deleteError}</Alert>}
                {containers.length === 0 &&
                <p>{cockpit.format(_("Empty pod $0 will be permanently removed."), pod.Name)}</p>
                }
                {containers.length > 0 &&
                <Stack hasGutter>
                    <p>{_("Deleting this pod will remove the following containers:")}</p>
                    <List>
                        {containers.map(container => <ListItem key={container.Names}>{container.Names}</ListItem>)}
                    </List>
                </Stack>}
            </ModalBody>
            <ModalFooter>
                <Button variant="danger"
                                onClick={handlePodDelete}>
                    {force ? _("Force delete") : _("Delete")}
                </Button>
                {' '}
                <Button variant="link" onClick={Dialogs.close}>
                    {_("Cancel")}
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export const PodActions = ({ con, onAddNotification, pod, isPodService }) => {
    const Dialogs = useDialogs();

    const dropdownItems = [];
    // Possible Pod Statuses can be found here https://github.com/containers/podman/blob/main/libpod/define/podstate.go
    if (pod.Status == "Running" || pod.Status == "Paused") {
        dropdownItems.push(
            <DropdownItem key="action-stop"
                              className="pod-action-stop"
                              onClick={() =>
                                  client.postPod(con, "stop", pod.Id, {})
                                          .catch(ex => {
                                              const error = cockpit.format(_("Failed to stop pod $0"), pod.Name);
                                              onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                                          })}
                              component="button">
                {_("Stop")}
            </DropdownItem>,
            <DropdownItem key="action-force-stop"
                              className="pod-action-force-stop"
                              onClick={() =>
                                  client.postPod(con, "stop", pod.Id, { t: 0 })
                                          .catch(ex => {
                                              const error = cockpit.format(_("Failed to force stop pod $0"), pod.Name);
                                              onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                                          })}
                              component="button">
                {_("Force stop")}
            </DropdownItem>,
            <DropdownItem key="action-restart"
                              className="pod-action-restart"
                              onClick={() =>
                                  client.postPod(con, "restart", pod.Id, {})
                                          .catch(ex => {
                                              const error = cockpit.format(_("Failed to restart pod $0"), pod.Name);
                                              onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                                          })}
                              component="button">
                {_("Restart")}
            </DropdownItem>,
            <DropdownItem key="action-force-restart"
                              className="pod-action-force-restart"
                              onClick={() =>
                                  client.postPod(con, "restart", pod.Id, { t: 0 })
                                          .catch(ex => {
                                              const error = cockpit.format(_("Failed to force restart pod $0"), pod.Name);
                                              onAddNotification({ type: 'danger', error, errorDetail: ex.message });
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
                                  client.postPod(con, "start", pod.Id, {})
                                          .catch(ex => {
                                              const error = cockpit.format(_("Failed to start pod $0"), pod.Name);
                                              onAddNotification({ type: 'danger', error, errorDetail: ex.message });
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
                                  client.postPod(con, "unpause", pod.Id, {})
                                          .catch(ex => {
                                              const error = cockpit.format(_("Failed to resume pod $0"), pod.Name);
                                              onAddNotification({ type: 'danger', error, errorDetail: ex.message });
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
                                  client.postPod(con, "pause", pod.Id, {})
                                          .catch(ex => {
                                              const error = cockpit.format(_("Failed to pause pod $0"), pod.Name);
                                              onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                                          })}
                              component="button">
                {_("Pause")}
            </DropdownItem>,
        );
    }

    if (dropdownItems.length > 1) {
        dropdownItems.push(<Divider key="separator-1" />);
    }
    dropdownItems.push(
        <DropdownItem key="action-delete"
                          className="pod-action-delete pf-m-danger"
                          onClick={() => {
                              Dialogs.show(<PodDeleteModal con={con} pod={pod} />);
                          }}
                          component="button">
            {_("Delete")}
        </DropdownItem>,
    );

    if (!dropdownItems.length)
        return null;

    return (
        <KebabDropdown
            toggleButtonId={"pod-" + pod.Name + (pod.uid === 0 ? "-system" : "-user") + "-action-toggle"}
            position="right"
            dropdownItems={dropdownItems}
            isDisabled={isPodService}
        />
    );
};
