import React, {Component, PropTypes} from 'react';
import {Modal, ModalHeader, ModalBody, ModalFooter} from './Modal'

class PromptModal extends Component {
  render () {
    return (
      <Modal onClose={this.props.onClose}>
        <ModalHeader>{this.props.header}</ModalHeader>
        <ModalBody><input type="text"/></ModalBody>
        <ModalFooter>Footer</ModalFooter>
      </Modal>
    )
  }
}

PromptModal.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  header: PropTypes.string.isRequired,
  onClose: PropTypes.func
};

export default PromptModal;
