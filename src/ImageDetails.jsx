import React from 'react';
import cockpit from 'cockpit';
import * as utils from './util.js';

const moment = require('moment');
const _ = cockpit.gettext;

const truncate_id = (id) => {
    return id.substr(0, 12);
};

const ImageDetails = (props) => {
    const image = props.image;
    const created = moment(image.Created, "YYYY-MM-DDTHH:mm:ss.SZ").calendar();

    return (
        <dl className='image-details'>
            <dt>{_("ID")}</dt>
            <dd title={image.Id}>{truncate_id(image.Id)}</dd>
            <dt>{_("Tags")}</dt>
            <dd>{image.RepoTags ? image.RepoTags.join(" ") : ""}</dd>
            <dt>{_("Entrypoint")}</dt>
            <dd>{image.Entrypoint ? image.Entrypoint.join(" ") : ""}</dd>
            <dt>{_("Command")}</dt>
            <dd>{image.Command ? utils.quote_cmdline(image.Command) : "" }</dd>
            <dt>{_("Created")}</dt>
            <dd>{created}</dd>
            <dt>{_("Author")}</dt>
            <dd>{image.Author}</dd>
            <dt>{_("Ports")}</dt>
            <dd>{image.Ports ? image.Ports.join(', ') : ""}</dd>
        </dl>
    );
};

export default ImageDetails;
