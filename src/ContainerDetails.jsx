import React from 'react';
import cockpit from 'cockpit';
import * as utils from './util.js';

import { DescriptionList, DescriptionListTerm, DescriptionListDescription, DescriptionListGroup, Flex } from "@patternfly/react-core";

const _ = cockpit.gettext;

const render_container_state = (container) => {
    if (container.State === "running") {
        return cockpit.format(_("Up since $0"), utils.localize_time(container.StartedAt));
    }
    return cockpit.format(_("Exited"));
};

const render_container_published_ports = (ports) => {
    const result = [];
    if (!ports)
        return result;
    for (let i = 0; i < ports.length; ++i)
        result.push(
            <React.Fragment key={ ports[i].protocol + ports[i].hostPort + ports[i].containerPort }>
                { ports[i].hostIP || '0.0.0.0' }:{ ports[i].hostPort } &rarr; { ports[i].containerPort }/{ ports[i].protocol }{ i < ports.length - 1 && ', ' }
            </React.Fragment>);
    return result;
};

const ContainerDetails = ({ container, containerDetail }) => {
    const ports = render_container_published_ports(container.Ports);

    return (
        <Flex spaceItems={{ modifier: 'spaceItemsXl' }}>
            <DescriptionList className='container-details-basic'>
                <DescriptionListGroup>
                    <DescriptionListTerm>{_("ID")}</DescriptionListTerm>
                    <DescriptionListDescription>{container.Id}</DescriptionListDescription>
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
            <DescriptionList columnModifier={{ default: '2Col' }} className='container-details-networking'>
                {ports.length > 0 && <DescriptionListGroup>
                    <DescriptionListTerm>{_("Ports")}</DescriptionListTerm>
                    <DescriptionListDescription>{ports}</DescriptionListDescription>
                </DescriptionListGroup>}
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
            </DescriptionList>
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
        </Flex>
    );
};

export default ContainerDetails;
