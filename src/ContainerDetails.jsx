/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { DescriptionList, DescriptionListDescription, DescriptionListGroup, DescriptionListTerm } from "@patternfly/react-core/dist/esm/components/DescriptionList";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex";

import cockpit from 'cockpit';

import * as utils from './util.js';

const _ = cockpit.gettext;

const render_container_state = (container) => {
    if (container.State.Status === "running") {
        return <><span>{ _("Up since:") } </span><utils.RelativeTime time={container.State.StartedAt} /></>;
    }
    return cockpit.format(_("Exited"));
};

const ContainerDetails = ({ container }) => {
    const networkOptions = (
        [
            container.NetworkSettings?.IPAddress,
            container.NetworkSettings?.Gateway,
            container.NetworkSettings?.MacAddress,
        ].some(itm => !!itm)
    );

    return (
        <Flex>
            <FlexItem>
                <DescriptionList className='container-details-basic'>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("ID")}</DescriptionListTerm>
                        <DescriptionListDescription className="ignore-pixels">{utils.truncate_id(container.Id)}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Image")}</DescriptionListTerm>
                        <DescriptionListDescription>{container.ImageName}</DescriptionListDescription>
                    </DescriptionListGroup>
                    {container.Config?.Cmd &&
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Command")}</DescriptionListTerm>
                        <DescriptionListDescription>{utils.quote_cmdline(container.Config.Cmd)}</DescriptionListDescription>
                    </DescriptionListGroup>
                    }
                    {utils.is_systemd_service(container.Config) && (container.uid === 0 || container.uid === null) &&
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("systemd service")}</DescriptionListTerm>
                        <DescriptionListDescription>
                            <Button variant="link" isInline onClick={
                                () => cockpit.jump(`/system/services#/${container.Config?.Labels?.PODMAN_SYSTEMD_UNIT}` + (container.uid === null ? "?owner=user" : ""))}>
                                {cockpit.format(_("View $0"), container.Config?.Labels?.PODMAN_SYSTEMD_UNIT)}
                            </Button>
                        </DescriptionListDescription>
                    </DescriptionListGroup>
                    }
                </DescriptionList>
            </FlexItem>
            <FlexItem>
                {networkOptions && <DescriptionList columnModifier={{ default: '2Col' }} className='container-details-networking'>
                    {container.NetworkSettings?.IPAddress && <DescriptionListGroup>
                        <DescriptionListTerm>{_("IP address")}</DescriptionListTerm>
                        <DescriptionListDescription className="ignore-pixels">{container.NetworkSettings.IPAddress}</DescriptionListDescription>
                    </DescriptionListGroup>}
                    {container.NetworkSettings?.Gateway && <DescriptionListGroup>
                        <DescriptionListTerm>{_("Gateway")}</DescriptionListTerm>
                        <DescriptionListDescription className="ignore-pixels">{container.NetworkSettings.Gateway}</DescriptionListDescription>
                    </DescriptionListGroup>}
                    {container.NetworkSettings?.MacAddress && <DescriptionListGroup>
                        <DescriptionListTerm>{_("MAC address")}</DescriptionListTerm>
                        <DescriptionListDescription className="container-mac-address">{container.NetworkSettings.MacAddress}</DescriptionListDescription>
                    </DescriptionListGroup>}
                </DescriptionList>}
            </FlexItem>
            <FlexItem>
                <DescriptionList className='container-details-state'>
                    {container.Created &&
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Created")}</DescriptionListTerm>
                        <DescriptionListDescription className="container-created"><utils.RelativeTime time={container.Created} /></DescriptionListDescription>
                    </DescriptionListGroup>
                    }
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("State")}</DescriptionListTerm>
                        <DescriptionListDescription>{render_container_state(container)}</DescriptionListDescription>
                    </DescriptionListGroup>
                    {container.State?.Checkpointed && <DescriptionListGroup>
                        <DescriptionListTerm>{_("Latest checkpoint")}</DescriptionListTerm>
                        <DescriptionListDescription className="container-latest-checkpoint"><utils.RelativeTime time={container.State.CheckpointedAt} /></DescriptionListDescription>
                    </DescriptionListGroup>}
                </DescriptionList>
            </FlexItem>
        </Flex>
    );
};

export default ContainerDetails;
