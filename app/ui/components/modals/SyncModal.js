import React, {Component} from 'react';
import Modal from '../base/Modal';
import PromptButton from '../base/PromptButton';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as session from '../../../backend/sync/session';
import * as syncStorage from '../../../backend/sync/storage';
import * as sync from '../../../backend/sync/index';

class SyncModal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      firstName: 'n/a',
      email: 'n/a',
      sessionId: 'n/a',
      dirty: []
    }
  }

  async _handleReset () {
    for (const r of await syncStorage.all()) {
      await syncStorage.remove(r);
    }
    this.hide();
  }

  _handleLogout () {
    session.logout();
    this.hide();
  }

  async _updateModal () {
    this.setState({
      numDirty: (await syncStorage.findDirty()).length,
      numSynced: (await syncStorage.all()).length,
      email: session.getEmail(),
      firstName: session.getFirstName(),
      sessionId: session.getCurrentSessionId(),
    });
  }

  async show () {
    if (!session.isLoggedIn()) {
      console.error('Not logged in');
      return;
    }

    clearInterval(this._interval);
    this._interval = setInterval(() => this._updateModal(), 2000);
    await this._updateModal();

    this.modal.show();
  }

  hide () {
    clearInterval(this._interval);
    this.modal.hide();
  }

  render () {
    const s = this.state;
    const data = [
      ['Num Synced', s.numSynced],
      ['Num Dirty', s.numDirty],
      ['Session ID', s.sessionId],
      ['Email', s.email],
    ];
    return (
      <Modal ref={m => this.modal = m}>
        <ModalHeader>Sync Settings</ModalHeader>
        <ModalBody className="wide pad">
          <h2>Hi {this.state.firstName}! Here is some useful debug info.</h2>
          <table>
            <tbody>
            {data.map(([label, value]) => (
              <tr key={label}>
                <td>{label}</td>
                <td><code className="txt-sm selectable">{value}</code></td>
              </tr>
            ))}
            </tbody>
          </table>
          <hr/>
          <code className="wide selectable txt-sm monospace scrollable"
                style={{maxHeight: '10rem'}}>
            {sync.logger.tail().map((entry, i) => {
              const timeString = new Date(entry.timestamp)
                .toISOString()
                .replace(/\..*/, '')
                .replace('T', ' ');
              return <div className="no-wrap" key={i}>
                {timeString} [{entry.type}] {entry.message}
              </div>
            })}
          </code>
        </ModalBody>
        <ModalFooter>
          <div>
            <PromptButton className="btn" onClick={e => this._handleLogout()}>
              Logout
            </PromptButton>
            <PromptButton className="btn" onClick={e => this._handleReset()}>
              Reset Account
            </PromptButton>
          </div>
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
