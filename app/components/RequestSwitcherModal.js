import React from 'react';

import Modal from './base/Modal';
import ModalBody from './base/ModalBody';
import ModalHeader from './base/ModalHeader';
import ModalFooter from './base/ModalFooter';
import ModalComponent from './lib/ModalComponent';

class RequestSwitcherModal extends ModalComponent {
  render() {
    return (
      <Modal ref="modal" {...this.props}>
        <ModalHeader>Switch Request</ModalHeader>
        <ModalBody className="pad">
          <p>DO IT</p>
        </ModalBody>
        <ModalFooter className="text-right">
        </ModalFooter>
      </Modal>
    );
  }
}

RequestSwitcherModal.propTypes = {};

export default RequestSwitcherModal;
