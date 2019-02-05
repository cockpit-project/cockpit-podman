import React from 'react';
import cockpit from 'cockpit';
import * as util from './util.js';

const moment = require('moment');
const _ = cockpit.gettext;

const render_container_state = (container) => {
    if (container.status === "running") {
        return cockpit.format(_("Up since $0"), moment(container.createdat, util.GOLANG_TIME_FORMAT).calendar());
    }
    return cockpit.format(_("Exited"));
};

const ContainerDetails = ({ container }) => (
    <div className='listing-ct-body'>
        <dl>
            <dt>{_("ID")}</dt>
            <dd>{container.id}</dd>
            <dt>{_("Created")}</dt>
            <dd>{moment(container.createdat, util.GOLANG_TIME_FORMAT).calendar()}</dd>
            <dt>{_("Image")}</dt>
            <dd>{container.image}</dd>
            <dt>{_("Command")}</dt>
            <dd>{container.command ? container.command.join(" ") : ""}</dd>
            <dt>{_("State")}</dt>
            <dd>{render_container_state(container)}</dd>
        </dl>
    </div>
);

export default ContainerDetails;
