import React, {Component} from 'react';
import classnames from 'classnames';
import GravatarImg from '../GravatarImg';
import Modal from '../base/Modal';
import PromptButton from '../base/PromptButton';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import * as session from '../../../backend/sync/session';
import * as syncStorage from '../../../backend/sync/storage';
import * as sync from '../../../backend/sync';
import * as db from '../../../backend/database';

class SyncModal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      firstName: 'n/a',
      email: 'n/a',
      sessionId: 'n/a',
      dirty: [],
      workspaceData: []
    }
  }

  async _handleEnableSync (workspaceData) {
    console.log('Enable sync', workspaceData);
  }

  async _handleReset () {
    for (const r of await syncStorage.allResources()) {
      await syncStorage.removeResource(r);
    }
    await session.logout();
    this.hide();
  }

  _handleLogout () {
    session.logout();
    this.hide();
  }

  async _updateModal () {
    const workspaces = await db.workspace.all();
    const workspaceData = [];
    for (const doc of workspaces) {
      const resource = await syncStorage.getResourceById(doc._id);
      workspaceData.push({doc, resource});
    }

    const totalResources = (await syncStorage.allResources()).length;
    const numDirty = (await syncStorage.findDirtyResources()).length;
    const numSynced = totalResources - numDirty;
    const percentSynced = parseInt(numSynced / totalResources * 10) / 10 * 100 || 0;

    this.setState({
      workspaceData,
      numDirty,
      numSynced,
      totalResources,
      percentSynced,
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
      ['Status', `${s.numSynced}/${s.totalResources} (${s.percentSynced}%)`],
      ['Session', s.sessionId.slice(0, 30)],
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
      <Modal ref={m => this.modal = m} tall={true} wide={true}>
        <ModalHeader>
          Sync Settings
          {" "}
          <span className="faint txt-md monospace">({s.email})</span>
        </ModalHeader>
        <ModalBody noScroll={true}>
          <Tabs>
            <TabList>
              <Tab>
                <button>Beta Info</button>
              </Tab>
              <Tab>
                <button>Teams</button>
              </Tab>
              <Tab>
                <button>Workspaces</button>
              </Tab>
              <Tab>
                <button>Debug Info</button>
              </Tab>
              <Tab>
                <button>Debug Logs</button>
              </Tab>
            </TabList>
            <TabPanel className="pad">
              <div className="pad-top">
                <GravatarImg email={this.state.email}
                             className="inline-block img--circle"
                             size={50}/>
                <div className="inline-block pad-left">
                  <h2 className="no-pad-bottom no-margin">
                    Hi {this.state.firstName}!
                  </h2>
                  <p>
                    You are currently signed in with
                    {" "}
                    <code>{this.state.email}</code>
                  </p>
                </div>
              </div>
              <hr/>
              <h2>Welcome to the beta</h2>
              <p>
                The sync beta is
              </p>
            </TabPanel>
            <TabPanel className="pad">
              <h2>Team</h2>
              <p>This is where you configure your team</p>
            </TabPanel>
            <TabPanel className="pad">
              <table>
                <thead>
                <tr>
                  <th>Sync</th>
                  <th>Created By</th>
                  <th>Name</th>
                  <th>Members</th>
                </tr>
                </thead>
                <tbody>
                {this.state.workspaceData.map(wd => (
                  <tr key={wd.doc._id}>
                    <td>
                      <input type="checkbox" checked={!!wd.resource}
                             onChange={this._handleEnableSync.bind(this, wd)}/>
                    </td>
                    <td>{(wd.resource || {}).createdBy === session.getAccountId() ? 'You' : 'Someone Else'}</td>
                    <td>{wd.doc.name}</td>
                    <td>
                      <GravatarImg email={this.state.email}
                                   className="img--circle"
                                   size={25}/>
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </TabPanel>
            <TabPanel className="pad">
              <p>
                Here is some useful debug info in case you need to report a bug.
              </p>
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
            </TabPanel>
            <TabPanel className="scrollable">
              <div className="selectable txt-sm monospace pad">
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
                  return (
                    <pre key={i}>
                      <span className="faint">{dateString}</span>
                      {" "}
                      <span style={{minWidth: '4rem'}}
                            className={classnames(colors[entry.type], 'inline-block')}>
                      [{entry.type}]
                    </span>
                      {" "}
                      {entry.message}
                    </pre>
                  )
                })}
              </div>
            </TabPanel>
          </Tabs>
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
