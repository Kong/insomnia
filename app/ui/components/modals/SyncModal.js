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
import {trackEvent} from '../../../backend/ganalytics';

class SyncModal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      firstName: 'n/a',
      email: 'n/a',
      sessionId: 'n/a',
      dirty: [],
      syncData: [],
      pushingResourceGroups: {},
      pullingResourceGroups: {},
    }
  }

  async _handlePushResourceGroupId (resourceGroupId) {
    // Set loading state
    const pushingResourceGroups = Object.assign({}, this.state.pushingResourceGroups);
    pushingResourceGroups[resourceGroupId] = true;
    this.setState({pushingResourceGroups});

    await sync.getOrCreateConfig(resourceGroupId);
    await sync.push(resourceGroupId);

    // Unset loading state
    delete pushingResourceGroups[resourceGroupId];
    this.setState({pushingResourceGroups});

    await this._updateModal();

    trackEvent('Sync', 'Push');
  }

  async _handlePullResourceGroupId (resourceGroupId) {
    // Set loading state
    const pullingResourceGroups = Object.assign({}, this.state.pushingResourceGroups);
    pullingResourceGroups[resourceGroupId] = true;
    this.setState({pullingResourceGroups});

    await sync.getOrCreateConfig(resourceGroupId);
    await sync.pull(resourceGroupId);

    // Unset loading state
    delete pullingResourceGroups[resourceGroupId];
    this.setState({pullingResourceGroups});

    await this._updateModal();

    trackEvent('Sync', 'Pull');
  }

  async _handleSyncModeChange (syncData, e) {
    const syncMode = e.target.value;
    const {resourceGroupId} = syncData.resource;
    await sync.createOrUpdateConfig(resourceGroupId, syncMode);

    // Refresh the modal
    this._updateModal();

    // Trigger a sync cycle right away
    await sync.triggerSync();

    trackEvent('Sync', 'Change Mode', syncMode);
  }

  async _handleReset () {
    this.hide();
    trackEvent('Sync', 'Reset');
    await session.logout();
    await sync.resetLocalData();
    await sync.resetRemoteData();
  }

  async _handleLogout () {
    this.hide();
    await sync.resetLocalData();
    await session.logout();
  }

  async _updateModal () {
    const workspaces = await db.workspace.all();
    const syncData = [];
    for (const workspace of workspaces) {

      // Get or create any related sync data
      const resource = await sync.getOrCreateResourceForDoc(workspace);
      const resourceGroupId = resource.resourceGroupId;
      const config = await sync.getOrCreateConfig(resourceGroupId);

      // Analyze it
      const dirty = await syncStorage.findActiveDirtyResourcesForResourceGroup(resourceGroupId);
      const all = await syncStorage.findResourcesForResourceGroup(resourceGroupId);
      const numClean = all.length - dirty.length;

      let syncPercent;
      if (all.length === 0) {
        syncPercent = 100;
      } else {
        syncPercent = parseInt(numClean / all.length * 1000) / 10
      }

      syncData.push({
        resource,
        syncPercent,
        syncMode: config.syncMode,
        name: workspace.name,
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

    this.modal.show();

    clearInterval(this._interval);
    await this._updateModal();
    this._interval = setInterval(() => this._updateModal(), 2000);
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
      ['Partial Sync', `${sync.PUSH_DEBOUNCE_TIME / 1000} seconds after change`],
    ];

    const colors = {
      debug: 'info',
      warn: 'warning',
      error: 'danger'
    };

    // Show last N logs
    const allLogs = sync.logger.tail();
    const logs = allLogs.slice(allLogs.length - 500);

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
                {this.state.syncData.map(data => {
                    const {syncMode, name, syncPercent, resource} = data;
                    const {resourceGroupId} = resource;
                    return (
                      <tr key={resource._id}>
                        <td>{name}</td>
                        <td>
                          <select name="sync-type"
                                  id="sync-type"
                                  value={syncMode}
                                  onChange={this._handleSyncModeChange.bind(this, data)}>
                            <option value={syncStorage.SYNC_MODE_ON}>Automatic
                            </option>
                            <option value={syncStorage.SYNC_MODE_OFF}>Manual
                            </option>
                          </select>
                          &nbsp;&nbsp;
                          <button title="Check for remote changes"
                                  className="btn btn--super-duper-compact btn--outlined"
                                  onClick={e => this._handlePullResourceGroupId(resourceGroupId)}>
                            <i className={classnames(
                              'fa fa-download',
                              {'fa-spin': this.state.pullingResourceGroups[resourceGroupId]}
                            )}></i>
                            {" "}
                            Pull
                          </button>
                          {" "}
                          <button
                            title={syncPercent >= 99 ? 'Nothing to push' : 'Push local changes'}
                            disabled={syncPercent >= 99}
                            className="btn btn--super-duper-compact btn--outlined"
                            onClick={e => this._handlePushResourceGroupId(resourceGroupId)}>
                            <i className={classnames(
                              'fa fa-upload',
                              {'fa-spin': this.state.pushingResourceGroups[resourceGroupId]}
                            )}></i>
                            {" "}
                            Push
                          </button>
                        </td>
                        <td className={syncPercent < 99 ? 'warning' : ''}>
                          {syncPercent}%
                        </td>
                        <td className="faint italic">
                          <select name="team" id="team" disabled="disabled">
                            <option value="other">Coming soon...</option>
                          </select>
                        </td>
                      </tr>
                    )
                  }
                )}
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
                    <td>
                      <code className="txt-sm selectable">{value}</code>
                    </td>
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
