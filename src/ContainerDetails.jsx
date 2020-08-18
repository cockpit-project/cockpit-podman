import React from 'react';
import cockpit from 'cockpit';
import * as utils from './util.js';

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

const ContainerDetails = ({ container, containerDetail }) => (
    <dl className='container-details'>
        <dt>{_("ID")}</dt>
        <dd>{container.Id}</dd>
        <dt>{_("Created")}</dt>
        <dd>{utils.localize_time(container.Created)}</dd>
        <dt>{_("Image")}</dt>
        <dd>{container.Image}</dd>
        <dt>{_("Command")}</dt>
        <dd>{container.Command ? utils.quote_cmdline(container.Command) : ""}</dd>
        <dt>{_("State")}</dt>
        <dd>{render_container_state(container)}</dd>
        <dt>{_("Ports")}</dt>
        <dd>{render_container_published_ports(container.Ports)}</dd>
        <dt>{_("IP Address")}</dt>
        <dd>{containerDetail ? containerDetail.NetworkSettings.IPAddress : ""}</dd>
        <dt>{_("IP Prefix Length")}</dt>
        <dd>{containerDetail ? containerDetail.NetworkSettings.IPPrefixLen : ""}</dd>
        <dt>{_("Gateway")}</dt>
        <dd>{containerDetail ? containerDetail.NetworkSettings.Gateway : ""}</dd>
        <dt>{_("MAC Address")}</dt>
        <dd>{containerDetail ? containerDetail.NetworkSettings.MacAddress : ""}</dd>
    </dl>
);

export default ContainerDetails;
