import React from 'react';
import cockpit from 'cockpit';

const moment = require('moment');
const _ = cockpit.gettext;

const render_container_state = (state) => {
    if (state.Running) {
        const momentDate = moment(state.StartedAt);
        return cockpit.format(_("Up since $0"), momentDate.isValid()
            ? momentDate.calendar() : state.startedAt);
    }
    return cockpit.format(_("Exited $ExitCode"), state);
};

const ContainerDetails = ({container}) => (
    <div className='listing-ct-body'>
        <dl>
            <dt>{_("ID")}</dt>
            <dd>{container.ID}</dd>
            <dt>{_("Created")}</dt>
            <dd>{moment(container.Created).isValid() ? moment(container.Created).calendar() : container.Created}</dd>
            <dt>{_("Image")}</dt>
            <dd>{container.ImageName}</dd>
            <dt>{_("Command")}</dt>
            <dd>{container.Config.Cmd ? container.Config.Cmd.join(" ") : ""}</dd>
            <dt>{_("State")}</dt>
            <dd>{render_container_state(container.State)}</dd>
        </dl>
    </div>
);

export default ContainerDetails;
