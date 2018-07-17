import React from 'react';
import Modal from 'react-modal';

const ContainersRunImageModal = (props) => {
    return (
        <Modal isOpen={props.show}>
            <h4>Test</h4>
            <button onClick={props.handleCancelRunImage}>Cancel</button>
        </Modal>
    );
}

export default ContainersRunImageModal;
