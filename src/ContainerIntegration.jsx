import React, { useState } from 'react';
import cockpit from 'cockpit';

import { Button, DescriptionList, DescriptionListTerm, DescriptionListDescription, DescriptionListGroup, List, ListItem, Tooltip } from "@patternfly/react-core";

import { EmptyStatePanel } from "cockpit-components-empty-state.jsx";

const _ = cockpit.gettext;

const renderContainerPublishedPorts = (ports) => {
    if (!ports)
        return null;

    const result = ports.map(port => {
        // podman v4 has different names than v3
        const protocol = port.protocol;
        const hostPort = port.hostPort || port.host_port;
        const containerPort = port.containerPort || port.container_port;
        const hostIp = port.hostIP || port.host_ip || '0.0.0.0';

        return (
            <ListItem key={ protocol + hostPort + containerPort }>
                { hostIp }:{ hostPort } &rarr; { containerPort }/{ protocol }
            </ListItem>
        );
    });

    return <List isPlain>{result}</List>;
};

const renderContainerVolumes = (volumes) => {
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

const renderContainerEnv = (containerEnv, imageEnv) => {
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

const ContainerIntegration = ({ container, containerDetail, localImages }) => {
    if (containerDetail === null || localImages === null) {
        return (
            <EmptyStatePanel title='Loading details...' loading />
        );
    }

    const ports = renderContainerPublishedPorts(container.Ports);
    const volumes = renderContainerVolumes(containerDetail.Mounts);

    const image = localImages.filter(img => img.Id === container.ImageID)[0];
    const env = renderContainerEnv(containerDetail.Config.Env, image.Env);

    return (
        <DescriptionList isAutoColumnWidths columnModifier={{ md: '3Col' }} className='container-integration'>
            {ports && <DescriptionListGroup>
                <DescriptionListTerm>{_("Ports")}</DescriptionListTerm>
                <DescriptionListDescription>{ports}</DescriptionListDescription>
            </DescriptionListGroup>}
            {volumes && <DescriptionListGroup>
                <DescriptionListTerm>{_("Volumes")}</DescriptionListTerm>
                <DescriptionListDescription>{volumes}</DescriptionListDescription>
            </DescriptionListGroup>}
            {env && <DescriptionListGroup>
                <DescriptionListTerm>{_("Environment variables")}</DescriptionListTerm>
                <DescriptionListDescription>{env}</DescriptionListDescription>
            </DescriptionListGroup>}
        </DescriptionList>
    );
};

export default ContainerIntegration;
