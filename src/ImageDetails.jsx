import React from 'react';
import cockpit from 'cockpit';
import * as util from './util.js';

const moment = require('moment');
const _ = cockpit.gettext;

const truncate_id = (id) => {
    return id.substr(0, 12);
};

const ImageDetails = (props) => {
    const image = props.image;
    let created = image.created;

    return (
        <div className='listing-ct-body'>
            <dl>
                <dt>{_("ID")}</dt>
                <dd title={image.id}>{truncate_id(image.id)}</dd>
                <dt>{_("Tags")}</dt>
                <dd>{image.repoTags ? image.repoTags.join(" ") : ""}</dd>
                <dt>{_("Entrypoint")}</dt>
                <dd>{image.entrypoint ? image.entrypoint.join(" ") : ""}</dd>
                <dt>{_("Command")}</dt>
                <dd>{image.command ? util.quote_cmdline(image.command) : "" }</dd>
                <dt>{_("Created")}</dt>
                <dd title={created.toLocaleString()}>{moment(created, util.GOLANG_TIME_FORMAT).calendar()}</dd>
                <dt>{_("Author")}</dt>
                <dd>{image.author}</dd>
                <dt>{_("Ports")}</dt>
                <dd>{image.ports ? image.ports.join(', ') : ""}</dd>
            </dl>
        </div>
    );
};

export default ImageDetails;
