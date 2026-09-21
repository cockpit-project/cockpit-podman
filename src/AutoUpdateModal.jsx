/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React, { useEffect, useState } from 'react';

import { Badge, Form, FormGroup, Radio } from '@patternfly/react-core';
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { SortByDirection } from '@patternfly/react-table';
import { ListingTable } from 'cockpit-components-table.js';
import { useDialogs } from "dialogs.jsx";

import cockpit from 'cockpit';
import { EmptyStatePanel } from 'cockpit-components-empty-state';

import { ErrorNotification } from './Notification.js';
import * as client from './client.js';

const _ = cockpit.gettext;

const updateStatusColumn = (updated) => {
    switch (updated) {
    case 'failed': return { label: 'Failed', classSuffix: 'failed', sortOrder: 0 };
    case 'rolled back': return { label: 'Rolled back', classSuffix: 'rolled-back', sortOrder: 0 };
    case 'true': return { label: 'Updated', classSuffix: 'updated', sortOrder: 1 };
    case 'pending': return { label: 'Update available', classSuffix: 'pending', sortOrder: 1 };
    case 'false': return { label: 'Up to date', classSuffix: undefined, sortOrder: 2 };
    default: return updated;
    }
};

const getContainerRow = (report) => {
    const status = updateStatusColumn(report.Updated);

    const statusClassName = status.classSuffix ? `ct-badge-autoupdate-${status.classSuffix}` : undefined;

    const columns = [
        {
            title: report.ContainerName,
            sortKey: report.ContainerName,
            props: { width: 25, },
        },
        {
            title: report.ImageName,
            sortKey: report.ImageName,
            props: { width: 25, },
        },
        {
            title: <Badge isRead className={statusClassName}>{status.label}</Badge>,
            sortKey: `${status.sortOrder}`,
            props: { width: 25, },
        },
    ];

    return { columns, props: { key: report.ContainerID } };
};

const AutoUpdateModal = ({ users }) => {
    const Dialogs = useDialogs();

    const [owner, setOwner] = useState(users[0]);
    const [isUpdating, setUpdating] = useState(false);
    const [reports, setReports] = useState();
    const [errors, setErrors] = useState();

    useEffect(() => {
        setReports(undefined);
        setErrors(undefined);
        setUpdating(false);

        client.autoUpdate(owner.con, true)
                .then((r) => {
                    setReports(r.Reports ?? []);
                    setErrors(r.Errors);
                })
                .catch((e) => {
                    setErrors([e.toString()]);
                });
    }, [owner]);

    const handleUpdate = () => {
        setUpdating(true);

        client.autoUpdate(owner.con, false)
                .then((r) => {
                    setReports(r.Reports ?? []);
                    setErrors(r.Errors);
                    setUpdating(false);
                })
                .catch((e) => {
                    setErrors([e.toString()]);
                    setUpdating(false);
                });
    };

    const columns = [
        { title: _("Container"), sortable: true },
        { title: _("Image"), sortable: true },
        { title: _("Status"), sortable: true },
    ];
    console.log(reports, reports?.map(report => getContainerRow(report)));
    return (
        <Modal isOpen
            position="top"
            variant="medium"
        >
            <ModalHeader title={_("Auto update")} />
            <ModalBody>
                <Form isHorizontal>
                    {errors?.length && <ErrorNotification errorMessage="Error" errorDetail={errors.join("\n")} />}
                    { users.length > 1 &&
                    <FormGroup fieldId='auto-update-dialog-owner' label={_("Owner")} isInline disabled={isUpdating}>
                        { users.map(user => (
                            <Radio key={user.name}
                                value={user.name}
                                label={user.uid === 0 ? _("System") : cockpit.format("$0 $1", _("User:"), user.name)}
                                id={`auto-update-dialog-owner-${user.name}` }
                                isChecked={owner === user}
                                onChange={() => setOwner(user)} />))
                        }
                    </FormGroup>
                    }
                </Form>

                {
                    isUpdating
                        ? <EmptyStatePanel title={_("Updating...")} loading />
                        : reports
                            ? reports.length
                                ? <ListingTable columns={columns}
                                        id="auto-update-container-list"
                                        rows={reports.map(report => getContainerRow(report)) }
                                        variant="compact" sortBy={{ index: 2, direction: SortByDirection.asc }} />
                                : <EmptyStatePanel icon={ExclamationCircleIcon}
                                    title={_("No auto-update containers")}
                                    paragraph={_("There are no containers with an auto-update configuration.")} />
                            : <EmptyStatePanel title={_("Checking for updates...")} loading />
                }
            </ModalBody>
            <ModalFooter>
                <Button variant="primary"
                        isDisabled={!reports?.some(r => r.Updated == 'pending') || isUpdating}
                        onClick={handleUpdate}>
                    {_("Update")}
                </Button>

                <Button variant="link"
                        isDisabled={isUpdating}
                        onClick={Dialogs.close}>
                    {_("Close")}
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export default AutoUpdateModal;
