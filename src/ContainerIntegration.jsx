import React, { useState } from 'react';
import cockpit from 'cockpit';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { DescriptionList, DescriptionListDescription, DescriptionListGroup, DescriptionListTerm } from "@patternfly/react-core/dist/esm/components/DescriptionList";
import { List, ListItem } from "@patternfly/react-core/dist/esm/components/List";
import { Tooltip } from "@patternfly/react-core/dist/esm/components/Tooltip";

import { EmptyStatePanel } from "cockpit-components-empty-state.jsx";

const _ = cockpit.gettext;

// ports is a mapping like { "5000/tcp": [{"HostIp": "", "HostPort": "6000"}] }
export const renderContainerPublishedPorts = ports => {
    if (!ports)
        return null;

    const items = [];
    Object.entries(ports).forEach(([containerPort, hostBindings]) => {
        (hostBindings ?? []).forEach(binding => { // not-covered: null was observed in the wild, but unknown how to reproduce
            items.push(
                <ListItem key={ containerPort + binding.HostIp + binding.HostPort }>
                    { binding.HostIp || "0.0.0.0" }:{ binding.HostPort } &rarr; { containerPort }
                </ListItem>
            );
        });
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
    const env = <ContainerEnv containerEnv={container.Config.Env} imageEnv={image.Env} />;

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
