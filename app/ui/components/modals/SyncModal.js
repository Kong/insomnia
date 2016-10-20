import React, {Component} from 'react';
import classnames from 'classnames';
import GravatarImg from '../GravatarImg';
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
    const percentSynced = totalResources === 0 ? 0 : parseInt(numSynced / totalResources * 10) / 10 * 100;

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
    const logs = allLogs.slice(allLogs.length - 2000);

    return (
      <Modal ref={m => this.modal = m}>
        <ModalHeader>
          Sync Settings <span
          className="faint txt-md monospace">({s.email})</span>
        </ModalHeader>
        <ModalBody className="wide pad">
          <h2>Hi {this.state.firstName}! Here is some useful debug info.</h2>
          <GravatarImg email={this.state.email}></GravatarImg>
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
          <pre style={{maxHeight: '13rem'}}
               className="wide outlined pad-sm selectable txt-sm monospace scrollable">
            {logs.map((entry, i) => {
              function pad (n, length) {
                let s = n + '';
                while (s.length < length) {
                  s = '0' + s;
                }
                return s;
              }

              const dateString =
                pad(entry.date.getFullYear(), 4) + '/' +
                pad(entry.date.getMonth(), 2) + '/' +
                pad(entry.date.getDay(), 2) + ' ' +
                pad(entry.date.getHours(), 2) + ':' +
                pad(entry.date.getMinutes(), 2) + ':' +
                pad(entry.date.getSeconds(), 2);

              //.replace(/\..*/, '')
              //.replace('T', ' ');
              return <div className="no-wrap" key={i}>
                <span className="faint">{dateString}</span>
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
