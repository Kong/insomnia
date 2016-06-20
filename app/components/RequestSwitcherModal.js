import React, {Component, PropTypes} from 'react'

import Modal from './base/Modal'
import ModalBody from './base/ModalBody'
import ModalHeader from './base/ModalHeader'
import ModalFooter from './base/ModalFooter'
import {MODAL_REQUEST_SWITCHER} from '../lib/constants'

class RequestSwitcherModal extends Component {
  render () {
    return (
      <Modal {...this.props}>
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

RequestSwitcherModal.defaultProps = {
  id: MODAL_REQUEST_SWITCHER
};

export default RequestSwitcherModal;
