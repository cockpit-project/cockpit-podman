import React from 'react';
import cockpit from 'cockpit';
import * as utils from './util.js';

const moment = require('moment');
const _ = cockpit.gettext;

const render_container_state = (container) => {
    if (container.State === "running") {
        return cockpit.format(_("Up since $0"), moment(container.StartedAt * 1000).calendar());
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

const ContainerDetails = ({ container }) => (
    <dl className='container-details'>
        <dt>{_("ID")}</dt>
        <dd>{container.Id}</dd>
        <dt>{_("Created")}</dt>
        <dd>{moment(container.Created * 1000).calendar()}</dd>
        <dt>{_("Image")}</dt>
        <dd>{container.Image}</dd>
        <dt>{_("Command")}</dt>
        <dd>{container.Command ? utils.quote_cmdline(container.Command) : ""}</dd>
        <dt>{_("State")}</dt>
        <dd>{render_container_state(container)}</dd>
        <dt>{_("Ports")}</dt>
        <dd>{render_container_published_ports(container.Ports)}</dd>
    </dl>
);

export default ContainerDetails;
