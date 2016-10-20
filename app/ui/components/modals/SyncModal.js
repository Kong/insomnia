import React, {Component} from 'react';
import classnames from 'classnames';
import Modal from '../base/Modal';
import PromptButton from '../base/PromptButton';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as session from '../../../backend/sync/session';
import * as syncStorage from '../../../backend/sync/storage';
import * as sync from '../../../backend/sync';

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
    await session.logout();
    this.hide();
  }

  _handleLogout () {
    session.logout();
    this.hide();
  }

  async _updateModal () {
    const totalResources = (await syncStorage.all()).length;
    const numDirty = (await syncStorage.findDirty()).length;
    const numSynced = totalResources - numDirty;
    const percentSynced = parseInt(numSynced / totalResources * 10) / 10 * 100;

    this.setState({
      numDirty: numDirty,
      numSynced: numSynced,
      totalResources: totalResources,
      percentSynced: percentSynced,
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
      ['Synced', `${s.numSynced}/${s.totalResources} (${s.percentSynced}%)`],
      ['Session ID', s.sessionId],
      ['Full Sync', `${sync.FULL_SYNC_INTERVAL / 1000} second interval`],
      ['Partial Sync', `${sync.DEBOUNCE_TIME / 1000} seconds after change`],
    ];
    const colors = {
      debug: 'info',
      warn: 'warning',
      error: 'danger'
    };

    // Show last N logs
    const allLogs = sync.logger.tail();
    const logs = allLogs.slice(allLogs.length - 100);

    return (
      <Modal ref={m => this.modal = m}>
        <ModalHeader>
          Sync Settings <span className="faint txt-md monospace">({s.email})</span>
        </ModalHeader>
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
          <pre
            className="wide outlined pad-sm selectable txt-sm monospace scrollable"
            style={{maxHeight: '10rem'}}>
            {logs.map((entry, i) => {
              const timeString = new Date(entry.timestamp)
                .toISOString()
                .replace(/\..*/, '')
                .replace('T', ' ');
              return <div className="no-wrap" key={i}>
                <span className="faint">{timeString}</span>
                {" "}
                <span className={classnames(colors[entry.type], 'inline-block')}
                      style={{minWidth: '4rem'}}>
                  [{entry.type}]
                </span>
                {" "}
                {entry.message}
              </div>
            })}
          </pre>
        </ModalBody>
        <ModalFooter>
          <div>
            <PromptButton className="btn" onClick={e => this._handleLogout()}>
              Logout
            </PromptButton>
            <PromptButton className="btn warning"
                          onClick={e => this._handleReset()}
                          confirmMessage="Delete all sync-related data?">
              Reset Sync Account
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
