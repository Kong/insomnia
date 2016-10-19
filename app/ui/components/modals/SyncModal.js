import React, {Component} from 'react';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as session from '../../../backend/sync/session';

class SyncModal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      firstName: 'n/a',
      email: 'n/a',
      sessionId: 'n/a'
    }
  }

  _handleLogout () {
    session.logout();
    this.hide();
  }

  show () {
    if (!session.isLoggedIn()) {
      console.error('Not logged in');
      return;
    }

    this.setState({
      email: session.getEmail(),
      firstName: session.getFirstName(),
      sessionId: session.getCurrentSessionId(),
    });

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
            Hi {this.state.firstName}!
          </p>
          <p>
            <button className="btn btn--super-compact btn--outlined"
                    onClick={e => this._handleLogout()}>
              Logout
            </button>
          </p>
        </ModalBody>
        <ModalFooter>
          <code className="txt-xs selectable margin-left">{this.state.sessionId}</code>
          <button className="btn" onClick={e => this.modal.hide()}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    )
  }
}

SyncModal.propTypes = {};

export default SyncModal;
