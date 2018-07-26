import React from 'react';
import Modal from 'react-modal';

class ContainersRunImageModal extends React.Component {
    constructor(props) {
      super(props);

    }


    render() {
      return (
	<Modal
	  isOpen={this.props.show}
	>
	  <h4>Test</h4>
	  <button onClick={this.props.handleCancelRunImage}>Cancel</button>
	</Modal>
      );
    }
  }


export default ContainersRunImageModal;
