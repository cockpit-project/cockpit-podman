import React from 'react';
import cockpit from 'cockpit';

const _ = cockpit.gettext;
class ContainerDetails extends React.Component {
    constructor(props) {
        super(props);
    }


    render() {
        let container = this.props.container;
        return (
            <div className='listing-ct-body'>
                <dl>
                    <dt>{_("Id")}      </dt> <dd>{ container.ID }</dd>
                    <dt>{_("Created")} </dt>
                    <dd>{ container.Created.substr(0, 10) }</dd>
                    <dt>{_("Image")}   </dt> <dd>{ container.Image }</dd>
                    <dt>{_("Command")}</dt> <dd>{ container.Config.Cmd }</dd>
                    <dt>{_("State")}   </dt> <dd>{ container.Sate }</dd>
                </dl>
            </div>
        );
    }
}

export default ContainerDetails;