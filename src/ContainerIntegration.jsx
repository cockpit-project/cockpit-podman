import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { DescriptionList, DescriptionListDescription, DescriptionListGroup, DescriptionListTerm } from "@patternfly/react-core/dist/esm/components/DescriptionList";
import { List, ListItem } from "@patternfly/react-core/dist/esm/components/List";
import { Tooltip } from "@patternfly/react-core/dist/esm/components/Tooltip";

import cockpit from 'cockpit';
import { EmptyStatePanel } from "cockpit-components-empty-state.tsx";

const _ = cockpit.gettext;

// ports is a mapping like { "5000/tcp": [{"HostIp": "", "HostPort": "6000"}] }
export const renderContainerPublishedPorts = ports => {
    if (Object.keys(ports).length === 0)
        return null;

    const ranges = [];
    const items = [];

    // create port ranges
    Object.entries(ports).forEach(([containerPort, hostBindings]) => {
        const [port, proto] = containerPort.split('/');
        const portNumber = Number(port);
        // not-covered: null was observed in the wild, but unknown how to reproduce
        (hostBindings ?? []).forEach(binding => {
            const lastRange = ranges[ranges.length - 1];
            const hostIP = binding.HostIp || "0.0.0.0";
            const hostPort = Number(binding.HostPort);

            let isPortConsecutive = false;
            let isHostPortConsecutive = false;
            let isSameHostIP = false;
            let isSameProtocol = false;

            if (lastRange) {
                isPortConsecutive = portNumber === lastRange.endPort + 1;
                isHostPortConsecutive = hostPort === lastRange.hostEndPort + 1;
                isSameHostIP = hostIP === lastRange.hostIp;
                isSameProtocol = proto === lastRange.protocol;
            }

            if (isPortConsecutive && isHostPortConsecutive && isSameHostIP && isSameProtocol) {
                // ports are consecutive, so extend the range
                lastRange.endPort = portNumber;
                lastRange.hostEndPort = hostPort;
            } else {
                // ports are not consecutive, so start a new range
                ranges.push({
                    startPort: portNumber,
                    endPort: portNumber,
                    protocol: proto,
                    hostIp: hostIP,
                    hostStartPort: hostPort,
                    hostEndPort: hostPort
                });
            }
        });
    });

    // create list items based on the ranges
    ranges.forEach(({ startPort, endPort, protocol, hostIp, hostStartPort, hostEndPort }) => {
        items.push(
            <ListItem key={ startPort + hostIp + hostStartPort }>
                {hostIp}:{hostStartPort}{hostStartPort !== hostEndPort ? `-${hostEndPort}` : ''} &rarr; {startPort}{startPort !== endPort ? `-${endPort}` : ''}/{protocol}
            </ListItem>
        );
    });

    return <List isPlain>{items}</List>;
};

export const renderContainerVolumes = (volumes) => {
    if (!volumes.length)
        return null;

    const result = volumes.map(volume => {
        return (
            <ListItem key={volume.Source + volume.Destination}>
                {volume.Source}
                {volume.RW
                    ? <Tooltip content={_("Read-write access")}><span> &harr; </span></Tooltip>
                    : <Tooltip content={_("Read-only access")}><span> &rarr; </span></Tooltip>}
                {volume.Destination}
            </ListItem>
        );
    });

    return <List isPlain>{result}</List>;
};

const ContainerEnv = ({ containerEnv, imageEnv }) => {
    // filter out some Environment variables set by podman or by image
    const toRemoveEnv = [...imageEnv, 'container=podman'];
    let toShow = containerEnv.filter(variable => {
        if (toRemoveEnv.includes(variable)) {
            return false;
        }

        return !variable.match(/(HOME|TERM)=.*/);
    });

    // append filtered out variables to always shown variables when 'show more' is clicked
    const [showMore, setShowMore] = useState(false);
    if (showMore)
        toShow = toShow.concat(containerEnv.filter(variable => !toShow.includes(variable)));

    if (!toShow.length)
        return null;

    const result = toShow.map(variable => {
        return (
            <ListItem key={variable}>
                {variable}
            </ListItem>
        );
    });

    result.push(
        <ListItem key='show-more-env-button'>
            <Button variant='link' isInline
                onClick={() => setShowMore(!showMore)}>
                {showMore ? _("Show less") : _("Show more")}
            </Button>
        </ListItem>
    );

    return <List isPlain>{result}</List>;
};

const ContainerIntegration = ({ container, localImages }) => {
    if (localImages === null) { // not-covered: not a stable UI state
        return (
            <EmptyStatePanel title={_("Loading details...")} loading />
        );
    }

    const ports = renderContainerPublishedPorts(container.NetworkSettings.Ports);
    const volumes = renderContainerVolumes(container.Mounts);

    const image = localImages.filter(img => img.Id === container.Image)[0];
    let env = null;
    // Podman allows one to remove an image while it has a container attached
    if (image)
        env = <ContainerEnv containerEnv={container.Config.Env} imageEnv={image.Env} />;

    return (
        <DescriptionList isAutoColumnWidths columnModifier={{ md: '3Col' }} className='container-integration'>
            {ports && <DescriptionListGroup>
                <DescriptionListTerm>{_("Ports")}</DescriptionListTerm>
                <DescriptionListDescription className="container-integration-ports">{ports}</DescriptionListDescription>
            </DescriptionListGroup>}
            {volumes && <DescriptionListGroup>
                <DescriptionListTerm>{_("Volumes")}</DescriptionListTerm>
                <DescriptionListDescription className="container-integration-volumes">{volumes}</DescriptionListDescription>
            </DescriptionListGroup>}
            {env && <DescriptionListGroup>
                <DescriptionListTerm>{_("Environment variables")}</DescriptionListTerm>
                <DescriptionListDescription className="container-integration-envs">{env}</DescriptionListDescription>
            </DescriptionListGroup>}
        </DescriptionList>
    );
};

export default ContainerIntegration;
