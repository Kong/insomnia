import React, {Component} from 'react';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';

class SyncModal extends Component {
  show () {
    this.modal.show();
  }

  hide () {
    this.modal.hide();
  }

  render () {
    return (
      <Modal ref={m => this.modal = m}>
        <ModalHeader>Sync Settings</ModalHeader>
        <ModalBody className="wide pad">
          Hello there
        </ModalBody>
        <ModalFooter>
          <button className="btn pull-right" onClick={e => this.modal.hide()}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    )
  }
}

SyncModal.propTypes = {};

export default SyncModal;
