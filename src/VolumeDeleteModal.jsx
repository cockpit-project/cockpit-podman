import React from 'react';
import { Button, Modal } from '@patternfly/react-core';
import cockpit from 'cockpit';

const _ = cockpit.gettext;

export class VolumeDeleteModal extends React.Component {
    render() {
        return (
            <Modal isOpen
                   position="top" variant="medium"
                   onClose={this.props.handleCancelVolumeDeleteModal}
                   title={cockpit.format(_("Delete volume $0"), this.props.volumeWillDelete.Name)}
                   footer={<>
                       <Button id="btn-vol-delete" variant="danger"
                               onClick={() => this.props.handleRemoveVolume()}>
                           {_("Delete volume")}
                       </Button>
                       <Button variant="link" onClick={this.props.handleCancelVolumeDeleteModal}>{_("Cancel")}</Button>
                   </>}
            />
        );
    }
}
