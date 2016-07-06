import React, {Component, PropTypes} from 'react'

import Modal from './base/Modal'
import ModalBody from './base/ModalBody'
import ModalHeader from './base/ModalHeader'
import ModalFooter from './base/ModalFooter'
import {MODAL_SETTINGS} from '../lib/constants'

class SettingsModal extends Component {
  show() {
    this.refs.modal.show();
  }

  toggle() {
    this.refs.modal.toggle();
  }

  render() {
    return (
      <Modal ref="modal" {...this.props}>
        <ModalHeader>Settings</ModalHeader>
        <ModalBody className="pad">
          <p>Settings</p>
        </ModalBody>
        <ModalFooter className="text-right"></ModalFooter>
      </Modal>
    );
  }
}

SettingsModal.propTypes = {};

SettingsModal.defaultProps = {
  id: MODAL_SETTINGS
};

export default SettingsModal;
