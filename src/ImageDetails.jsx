import React from 'react';
import cockpit from 'cockpit';

const moment = require('moment');
const _ = cockpit.gettext;

const truncate_id = (id) => {
    return id.substr(0, 12);
}

const ImageDetails = (props) => {
    const image = props.image;
    let created = image.Created;
    let entrypoint = '';
    let command = '';
    let ports = [];

    if (image.ContainerConfig) {
        entrypoint = image.ContainerConfig.Entrypoint;
        command = image.ContainerConfig.Cmd;
        ports = Object.keys(image.ContainerConfig.ExposedPorts || {});
    }

    return (
        <div className='listing-ct-body'>
            <dl>
                <dt>{_("ID")}</dt>
                <dd title={image.Id}>{truncate_id(image.Id)}</dd>
                <dt>{_("Tags")}</dt>
                <dd>{image.RepoTags ? image.RepoTags.join(" "): ""}</dd>
                <dt>{_("Entrypoint")}</dt>
                <dd>{entrypoint ? entrypoint.join(" ") : ""}</dd>
                <dt>{_("Command")}</dt>
                <dd>{command ? command.join(" ") : "" }</dd>
                <dt>{_("Created")}</dt>
                <dd title={created.toLocaleString()}>{moment(created).isValid() ? moment(created).calendar() : created}</dd>
                <dt>{_("Author")}</dt>
                <dd>{image.Author}</dd>
                <dt>{_("Ports")}</dt>
                <dd>{ports.join(', ')}</dd>
            </dl>
        </div>
    );
}

export default ImageDetails;
