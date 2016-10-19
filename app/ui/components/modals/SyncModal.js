import React, {Component} from 'react';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as session from '../../../backend/sync/session';

class SyncModal extends Component {
  _handleLogout () {
    session.logout();
    this.hide();
  }

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
          <p>
            Hello there
          </p>
          <p>
            <button className="btn btn--super-compact btn--outlined"
                    onClick={e => this._handleLogout()}>
              Logout
            </button>
          </p>
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
