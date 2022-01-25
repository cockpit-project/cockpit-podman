import React from 'react';
import cockpit from 'cockpit';
import * as utils from './util.js';

import { DescriptionList, DescriptionListTerm, DescriptionListDescription, DescriptionListGroup, Flex, List, ListItem } from "@patternfly/react-core";

const _ = cockpit.gettext;

const render_container_state = (container) => {
    if (container.State === "running") {
        return cockpit.format(_("Up since $0"), utils.localize_time(container.StartedAt));
    }
    return cockpit.format(_("Exited"));
};

const render_container_published_ports = (ports) => {
    if (!ports)
        return null;

    const result = ports.map(port => {
        // podman v4 has different names than v3
        const protocol = port.protocol;
        const host_port = port.hostPort || port.host_port;
        const container_port = port.containerPort || port.container_port;
        const host_ip = port.hostIP || port.host_ip || '0.0.0.0';
        return (
            <ListItem key={ protocol + host_port + container_port }>
                { host_ip }:{ host_port } &rarr; { container_port }/{ protocol }
            </ListItem>
        );
    });

    return <List isPlain>{result}</List>;
};

const ContainerDetails = ({ container, containerDetail }) => {
    const ports = render_container_published_ports(container.Ports);
    const networkOptions = (
        containerDetail &&
        [
            containerDetail.NetworkSettings.IPAddress,
            containerDetail.NetworkSettings.Gateway,
            containerDetail.NetworkSettings.MacAddress,
            ports
        ].some(itm => !!itm)
    );

    return (
        <Flex spaceItems={{ modifier: 'spaceItemsXl' }}>
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
            {networkOptions && <DescriptionList columnModifier={{ default: '2Col' }} className='container-details-networking'>
                {ports && <DescriptionListGroup>
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
            </DescriptionList>}
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
