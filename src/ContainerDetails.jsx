import React from 'react';
import cockpit from 'cockpit';
import * as utils from './util.js';

import { DescriptionList, DescriptionListTerm, DescriptionListDescription, DescriptionListGroup, Flex, List, FlexItem, ListItem } from "@patternfly/react-core";

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

const render_container_mounts = (mounts) => {
    if (!mounts)
        return null;

    const result = mounts.map(mount => {
        const name = mount.Name;
        const type = mount.Type;
        const driver = mount.Driver;
        const source = mount.Source;
        const destination = mount.Destination;
        return (
            <ListItem key={ name }>
                { name } &rarr; { destination } <br />
                <small> { driver } { type }: <br />
                    { source }</small>
            </ListItem>
        );
    });

    return <List isPlain>{result}</List>;
};

const render_container_env = (env) => {
    if (!env)
        return null;

    const result = env.map(value => {
        const keyvalue = value.split("=");
        return (
            <ListItem key={ keyvalue[0] }>
                { keyvalue[0] } = <small>{ keyvalue[1] }</small>
            </ListItem>
        );
    });

    return <List isPlain>{result}</List>;
};

const ContainerDetails = ({ container, containerDetail }) => {
    const ports = render_container_published_ports(container.Ports);
    const mounts = (containerDetail && containerDetail.Mounts.length !== 0) ? render_container_mounts(containerDetail.Mounts) : null;
    const env = (containerDetail && containerDetail.Config) ? render_container_env(containerDetail.Config.Env) : null;
    const networkOptions = (
        containerDetail &&
        [
            containerDetail.NetworkSettings.IPAddress,
            containerDetail.NetworkSettings.Gateway,
            containerDetail.NetworkSettings.MacAddress,
            ports,
            mounts
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
                {networkOptions && <DescriptionList className='container-details-networking'>
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
            </FlexItem>
            <FlexItem>
                <DescriptionList className='container-details-mounts'>
                    {mounts && <DescriptionListGroup>
                        <DescriptionListTerm>{_("Mounts")}</DescriptionListTerm>
                        <DescriptionListDescription>{mounts}</DescriptionListDescription>
                    </DescriptionListGroup>}
                </DescriptionList>
            </FlexItem>
            <FlexItem>
                <DescriptionList className='container-details-env'>
                    {env && <DescriptionListGroup>
                        <DescriptionListTerm>{_("ENV")}</DescriptionListTerm>
                        <DescriptionListDescription>{env}</DescriptionListDescription>
                    </DescriptionListGroup>}
                </DescriptionList>
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
