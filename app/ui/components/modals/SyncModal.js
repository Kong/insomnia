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
      syncData: []
    }
  }

  async _handleSyncModeChange (syncData, e) {
    const syncMode = e.target.value;
    const workspace = syncData.workspace;
    const resource = await sync.getOrCreateResourceForDoc(workspace);

    const resourceGroupId = resource.resourceGroupId;
    const config = await syncStorage.getConfig(resource.resourceGroupId);
    const patch = {resourceGroupId, syncMode};

    if (config) {
      await syncStorage.updateConfig(config, patch);
    } else {
      await syncStorage.insertConfig(patch);
    }

    // Refresh the modal
    this._updateModal();
    sync.forceSync();
  }

  async _handleReset () {
    for (const r of await syncStorage.allResources()) {
      await syncStorage.removeResource(r);
    }
    for (const c of await syncStorage.allConfigs()) {
      await syncStorage.removeConfig(c);
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
    const syncData = [];
    for (const workspace of workspaces) {
      const resource = await syncStorage.getResourceById(workspace._id);
      const resourceGroupId = resource ? resource.resourceGroupId : null;
      const workspaceConfig = await syncStorage.getConfig(resourceGroupId);
      const dirty = await syncStorage.findActiveDirtyResourcesForResourceGroup(resourceGroupId);
      const all = await syncStorage.findResourcesForResourceGroup(resourceGroupId);
      syncData.push({
        workspace,
        resource,
        workspaceConfig,
        syncPercent: parseInt((all.length - dirty.length) / all.length * 10) / 10 * 100
      });
    }

    this.setState({
      syncData,
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
      ['Email', s.email],
      ['Session', s.sessionId],
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
    const logs = allLogs.slice(allLogs.length - 1000);

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
                <button>Overview</button>
              </Tab>
              <Tab>
                <button>Debug Info</button>
              </Tab>
              <Tab>
                <button>Debug Logs</button>
              </Tab>
            </TabList>
            <TabPanel className="pad scrollable">
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
              <table>
                <thead>
                <tr>
                  <th>Workspace</th>
                  <th>Sync</th>
                  <th>Synced</th>
                  <th>Team</th>
                </tr>
                </thead>
                <tbody>
                {this.state.syncData.map(data => (
                  <tr key={data.workspace._id}>
                    <td>{data.workspace.name}</td>
                    <td>
                      <select name="sync-type"
                              id="sync-type"
                              value={data.workspaceConfig ? data.workspaceConfig.syncMode : syncStorage.SYNC_MODE_OFF}
                              onChange={this._handleSyncModeChange.bind(this, data)}>
                        <option value={syncStorage.SYNC_MODE_ON}>Active</option>
                        <option value={syncStorage.SYNC_MODE_OFF}>Paused</option>
                      </select>
                    </td>
                    <td className={data.syncPercent < 99 ? 'warning' : ''}>
                      {data.syncPercent}%
                    </td>
                    <td className="faint italic">
                      <select name="team" id="team" disabled="disabled">
                        <option value="other">Coming soon...</option>
                      </select>
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </TabPanel>
            <TabPanel className="pad scrollable">
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
