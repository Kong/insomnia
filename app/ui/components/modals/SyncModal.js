import React, {Component} from 'react';
import classnames from 'classnames';
import Modal from '../base/Modal';
import PromptButton from '../base/PromptButton';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import * as session from '../../../sync/session';
import * as syncStorage from '../../../sync/storage';
import * as sync from '../../../sync';
import * as models from '../../../models';
import {trackEvent} from '../../../analytics';

class SyncModal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      firstName: 'n/a',
      email: 'n/a',
      sessionId: 'n/a',
      dirty: [],
      syncingResourceGroups: {},
      workspace: null,
      syncData: null
    }
  }

  async _handleSyncResourceGroupId (resourceGroupId) {
    // Set loading state
    const syncingResourceGroups = Object.assign({}, this.state.syncingResourceGroups);
    syncingResourceGroups[resourceGroupId] = true;
    this.setState({syncingResourceGroups});

    await sync.getOrCreateConfig(resourceGroupId);
    await sync.pull(resourceGroupId);
    await sync.pushActiveDirtyResources(resourceGroupId);

    // Unset loading state
    delete syncingResourceGroups[resourceGroupId];
    this.setState({syncingResourceGroups});

    await this._updateModal(this.state.workspace);

    trackEvent('Sync', 'Push');
  }

  async _handleSyncModeChange (syncData, syncMode) {
    const {resourceGroupId} = syncData.resource;
    await sync.createOrUpdateConfig(resourceGroupId, syncMode);

    // Refresh the modal
    this._updateModal(this.state.workspace);

    trackEvent('Sync', 'Change Mode', syncMode);
  }

  async _handleReset () {
    this.hide();
    trackEvent('Sync', 'Reset');
    await sync.resetRemoteData();
    await sync.resetLocalData();
    await session.logout();
  }

  async _handleLogout () {
    this.hide();
    sync.logout();
  }

  async _updateModal (workspace) {
    // Get or create any related sync data
    const resource = await sync.getOrCreateResourceForDoc(workspace);
    const resourceGroupId = resource.resourceGroupId;
    const config = await sync.getOrCreateConfig(resourceGroupId);

    // Analyze it
    const dirty = await syncStorage.findActiveDirtyResourcesForResourceGroup(resourceGroupId);
    const all = await syncStorage.findResourcesForResourceGroup(resourceGroupId);
    const numClean = all.length - dirty.length;
    const syncPercent = all.length === 0 ? 100 : parseInt(numClean / all.length * 1000) / 10;

    const syncData ={
      resource,
      syncPercent,
      syncMode: config.syncMode,
      name: workspace.name,
    };

    this.setState({
      syncData,
      workspace,
      email: session.getEmail(),
      firstName: session.getFirstName(),
      sessionId: session.getCurrentSessionId(),
    });
  }

  async show (workspaceId) {
    if (!session.isLoggedIn()) {
      console.error('Not logged in');
      return;
    }

    const workspace = await models.workspace.getById(workspaceId);
    if (!workspace) {
      return;
    }

    this.modal.show();
    await this._updateModal(workspace);

    clearInterval(this._interval); // Make sure it's off
    this._interval = setInterval(() => this._updateModal(workspace), 2000);
  }

  hide () {
    clearInterval(this._interval);
    this.modal.hide();
  }

  render () {
    const {
      email,
      sessionId,
      workspace,
      syncData,
      syncingResourceGroups
    } = this.state;

    const data = [
      ['Email', email],
      ['Session', sessionId],
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

    let modalBody = null;
    if (syncData) {
      const {syncMode, syncPercent, resource} = syncData;
      const {resourceGroupId} = resource;
      modalBody = (
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
            <h1>{workspace ? workspace.name : 'Loading...'} {syncPercent}%</h1>
            <div key={resource._id}>
              <select name="sync-type"
                      id="sync-type"
                      value={syncMode}
                      onChange={e => this._handleSyncModeChange(syncData, e.target.value)}>
                <option value={syncStorage.SYNC_MODE_ON}>Automatic</option>
                <option value={syncStorage.SYNC_MODE_OFF}>Manual</option>
              </select>
              &nbsp;&nbsp;
              <button
                title={syncPercent === 100 ? 'Nothing to push' : 'Push local changes'}
                disabled={syncPercent === 100}
                className="btn btn--super-duper-compact btn--outlined"
                onClick={e => this._handleSyncResourceGroupId(resourceGroupId)}>
                <i className={classnames(
                  'fa fa-refresh', {'fa-spin': syncingResourceGroups[resourceGroupId]}
                )}></i> Sync
              </button>
              <div>
                <select name="team" id="team" disabled="disabled">
                  <option value="other">Coming soon...</option>
                </select>
              </div>
            </div>
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
                  pad(entry.date.getMonth() + 1, 2) + '/' +
                  pad(entry.date.getDate(), 2) + ' ' +
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
      )
    }

    return (
      <Modal ref={m => this.modal = m} tall={true} wide={true}>
        <ModalHeader>Sync Settings</ModalHeader>
        <ModalBody noScroll={true}>{modalBody}</ModalBody>
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
