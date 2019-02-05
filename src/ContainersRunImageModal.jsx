import React from 'react';
import { Button, Modal } from 'patternfly-react';

const ContainersRunImageModal = (props) => {
    return (
        <Modal show={props.show}>
            <h4>Test</h4>
            <Button onClick={props.handleCancelRunImage}>Cancel</Button>
        </Modal>
    );
};

export default ContainersRunImageModal;
