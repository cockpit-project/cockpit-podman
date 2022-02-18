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

const render_container_published_volumes = (binds) => {
    if (!binds)
        return null;

    const result = binds.map(bind => {
        return (
            <ListItem key={ bind }>
                { bind }
            </ListItem>
        );
    });

    return <List isPlain>{result}</List>;
};

const render_container_published_environment = (envs) => {
    if (!envs)
        return null;

    const result = envs.map(env => {
        return (
            <ListItem key={ env }>
                { env }
            </ListItem>
        );
    });

    return <List isPlain>{result}</List>;
};

const render_container_published_networks = (networks) => {
    if (!networks)
        return null;

    const result = Object.entries(networks).map(([key, value]) => {
        return (
            <ListItem key={ key }>
                { key }: { value.Gateway }/{ value.IPPrefixLen }
            </ListItem>
        );
    });

    return <List isPlain>{result}</List>;
};

const ContainerDetails = ({ container, containerDetail }) => {
    const ports = render_container_published_ports(container.Ports);
    const volumes = (containerDetail && containerDetail.HostConfig) ? render_container_published_volumes(containerDetail.HostConfig.Binds) : null;
    const environment = (containerDetail && containerDetail.Config) ? render_container_published_environment(containerDetail.Config.Env) : null;
    const networks = (containerDetail && containerDetail.NetworkSettings) ? render_container_published_networks(containerDetail.NetworkSettings.Networks) : null;
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
                    <DescriptionListTerm>{_("State")}</DescriptionListTerm>
                    <DescriptionListDescription>{render_container_state(container)}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                    <DescriptionListTerm>{_("Created")}</DescriptionListTerm>
                    <DescriptionListDescription>{utils.localize_time(Date.parse(container.Created) / 1000)}</DescriptionListDescription>
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
            {networkOptions && <DescriptionList className='container-details-networking'>
                {containerDetail && containerDetail.NetworkSettings.MacAddress && <DescriptionListGroup>
                    <DescriptionListTerm>{_("MAC address")}</DescriptionListTerm>
                    <DescriptionListDescription>{containerDetail.NetworkSettings.MacAddress}</DescriptionListDescription>
                </DescriptionListGroup>}
                {containerDetail && containerDetail.NetworkSettings.IPAddress && <DescriptionListGroup>
                    <DescriptionListTerm>{_("IP address")}</DescriptionListTerm>
                    <DescriptionListDescription>{containerDetail.NetworkSettings.IPAddress}</DescriptionListDescription>
                </DescriptionListGroup>}
                {containerDetail && containerDetail.NetworkSettings.Gateway && <DescriptionListGroup>
                    <DescriptionListTerm>{_("Gateway")}</DescriptionListTerm>
                    <DescriptionListDescription>{containerDetail.NetworkSettings.Gateway}</DescriptionListDescription>
                </DescriptionListGroup>}
                {ports && <DescriptionListGroup>
                    <DescriptionListTerm>{_("Ports")}</DescriptionListTerm>
                    <DescriptionListDescription>{ports}</DescriptionListDescription>
                </DescriptionListGroup>}
            </DescriptionList>}
            <DescriptionList className='container-details-networks'>
                <DescriptionListGroup>
                    <DescriptionListTerm>{_("Networks")}</DescriptionListTerm>
                    <DescriptionListDescription>{networks}</DescriptionListDescription>
                </DescriptionListGroup>
            </DescriptionList>
            <DescriptionList className='container-details-volumes'>
                <DescriptionListGroup>
                    <DescriptionListTerm>{_("Volumes")}</DescriptionListTerm>
                    <DescriptionListDescription>{volumes}</DescriptionListDescription>
                </DescriptionListGroup>
            </DescriptionList>
            <DescriptionList className='container-details-environment'>
                <DescriptionListGroup>
                    <DescriptionListTerm>{_("Environment")}</DescriptionListTerm>
                    <DescriptionListDescription>{environment}</DescriptionListDescription>
                </DescriptionListGroup>
            </DescriptionList>
        </Flex>
    );
};

export default ContainerDetails;
