import React from 'react';
import cockpit from 'cockpit';

const moment = require('moment');
const _ = cockpit.gettext;

const render_container_state = (container) => {
    if (container.status === "running") {
        const momentDate = moment(container.createdat);
        return cockpit.format(_("Up since $0"), momentDate.isValid()
            ? momentDate.calendar() : container.createdat);
    }
    return cockpit.format(_("Exited"));
};

const ContainerDetails = ({container}) => (
    <div className='listing-ct-body'>
        <dl>
            <dt>{_("ID")}</dt>
            <dd>{container.id}</dd>
            <dt>{_("Created")}</dt>
            <dd>{moment(container.createdat).isValid() ? moment(container.createdat).calendar() : container.createdat}</dd>
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
