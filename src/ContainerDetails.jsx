import React from 'react';
import cockpit from 'cockpit';
import * as utils from './util.js';

import { DescriptionList, DescriptionListTerm, DescriptionListDescription, DescriptionListGroup, Flex, FlexItem } from "@patternfly/react-core";

const _ = cockpit.gettext;

const render_container_state = (container) => {
    if (container.State === "running") {
        return cockpit.format(_("Up since $0"), utils.localize_time(container.StartedAt));
    }
    return cockpit.format(_("Exited"));
};

const ContainerDetails = ({ container, containerDetail }) => {
    const networkOptions = (
        containerDetail &&
        [
            containerDetail.NetworkSettings.IPAddress,
            containerDetail.NetworkSettings.Gateway,
            containerDetail.NetworkSettings.MacAddress,
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
                        <DescriptionListDescription>{container.Image}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Command")}</DescriptionListTerm>
                        <DescriptionListDescription>{container.Command ? utils.quote_cmdline(container.Command) : ""}</DescriptionListDescription>
                    </DescriptionListGroup>
                </DescriptionList>
            </FlexItem>
            <FlexItem>
                {networkOptions && <DescriptionList columnModifier={{ default: '2Col' }} className='container-details-networking'>
                    {containerDetail && containerDetail.NetworkSettings.IPAddress && <DescriptionListGroup>
                        <DescriptionListTerm>{_("IP address")}</DescriptionListTerm>
                        <DescriptionListDescription>{containerDetail.NetworkSettings.IPAddress}</DescriptionListDescription>
                    </DescriptionListGroup>}
                    {containerDetail && containerDetail.NetworkSettings.Gateway && <DescriptionListGroup>
                        <DescriptionListTerm>{_("Gateway")}</DescriptionListTerm>
                        <DescriptionListDescription>{containerDetail.NetworkSettings.Gateway}</DescriptionListDescription>
                    </DescriptionListGroup>}
                    {containerDetail && containerDetail.NetworkSettings.MacAddress && <DescriptionListGroup>
                        <DescriptionListTerm>{_("MAC address")}</DescriptionListTerm>
                        <DescriptionListDescription>{containerDetail.NetworkSettings.MacAddress}</DescriptionListDescription>
                    </DescriptionListGroup>}
                </DescriptionList>}
            </FlexItem>
            <FlexItem>
                <DescriptionList className='container-details-state'>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Created")}</DescriptionListTerm>
                        <DescriptionListDescription>{utils.localize_time(Date.parse(container.Created) / 1000)}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("State")}</DescriptionListTerm>
                        <DescriptionListDescription>{render_container_state(container)}</DescriptionListDescription>
                    </DescriptionListGroup>
                </DescriptionList>
            </FlexItem>
        </Flex>
    );
};

export default ContainerDetails;
