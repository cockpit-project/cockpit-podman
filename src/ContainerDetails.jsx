import React from 'react';

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
                        <DescriptionListDescription>{utils.truncate_id(container.Id)}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Image")}</DescriptionListTerm>
                        <DescriptionListDescription>{container.ImageName}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Command")}</DescriptionListTerm>
                        <DescriptionListDescription>{utils.quote_cmdline(container.Config?.Cmd)}</DescriptionListDescription>
                    </DescriptionListGroup>
                </DescriptionList>
            </FlexItem>
            <FlexItem>
                {networkOptions && <DescriptionList columnModifier={{ default: '2Col' }} className='container-details-networking'>
                    {container.NetworkSettings?.IPAddress && <DescriptionListGroup>
                        <DescriptionListTerm>{_("IP address")}</DescriptionListTerm>
                        <DescriptionListDescription>{container.NetworkSettings.IPAddress}</DescriptionListDescription>
                    </DescriptionListGroup>}
                    {container.NetworkSettings?.Gateway && <DescriptionListGroup>
                        <DescriptionListTerm>{_("Gateway")}</DescriptionListTerm>
                        <DescriptionListDescription>{container.NetworkSettings.Gateway}</DescriptionListDescription>
                    </DescriptionListGroup>}
                    {container.NetworkSettings?.MacAddress && <DescriptionListGroup>
                        <DescriptionListTerm>{_("MAC address")}</DescriptionListTerm>
                        <DescriptionListDescription>{container.NetworkSettings.MacAddress}</DescriptionListDescription>
                    </DescriptionListGroup>}
                </DescriptionList>}
            </FlexItem>
            <FlexItem>
                <DescriptionList className='container-details-state'>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Created")}</DescriptionListTerm>
                        <DescriptionListDescription><utils.RelativeTime time={container.Created} /></DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("State")}</DescriptionListTerm>
                        <DescriptionListDescription>{render_container_state(container)}</DescriptionListDescription>
                    </DescriptionListGroup>
                    {container.State?.Checkpointed && <DescriptionListGroup>
                        <DescriptionListTerm>{_("Latest checkpoint")}</DescriptionListTerm>
                        <DescriptionListDescription><utils.RelativeTime time={container.State.CheckpointedAt} /></DescriptionListDescription>
                    </DescriptionListGroup>}
                </DescriptionList>
            </FlexItem>
        </Flex>
    );
};

export default ContainerDetails;
