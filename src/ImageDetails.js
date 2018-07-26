import React from 'react';
import cockpit from 'cockpit';
const _ = cockpit.gettext;
const moment = require('moment');

class ImageDetails extends React.Component {
    constructor(props) {
        super(props);
        this.truncate_id = this.truncate_id.bind(this);
    }

    truncate_id(id) {
        return id.substr(0, 12);
    }

    render() {
        let image = this.props.image;
        // let created = moment.unix(image.created);
        let created = image.Created.substr(0, 10);
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
                    <dt>{_("Id")}</dt>         <dd title={image.Id}>{this.truncate_id(image.Id)}</dd>
                    <dt>{_("Tags")}</dt>       <dd>{ image.RepoTags.join(" ") }</dd>
                    <dt>{_("Entrypoint")}</dt> <dd>{ entrypoint}</dd>
                    <dt>{_("Command")}</dt>    <dd>{ command }</dd>
                    <dt>{_("Created")}</dt>    <dd title={ created.toLocaleString() }>{ created }</dd>
                    <dt>{_("Author")}</dt>     <dd>{image.Author }</dd>
                    <dt>{_("Ports")}</dt>      <dd>{ ports.join(', ')}</dd>
                </dl>
            </div>
        );
    }
}

export default ImageDetails;
