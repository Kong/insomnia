import React, {Component} from 'react';
import classnames from 'classnames';
import Modal from '../base/Modal';
import PromptButton from '../base/PromptButton';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as session from '../../../sync/session';
import * as syncStorage from '../../../sync/storage';
import * as sync from '../../../sync';
import * as models from '../../../models';
import {trackEvent} from '../../../analytics';
import SyncLogsModal from './SyncLogsModal';
import {showModal} from './';

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

    const syncData = {
      resource,
      syncPercent,
      syncMode: config.syncMode,
      name: workspace.name,
    };

    this.setState({syncData, workspace});
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
    const {workspace, syncData, syncingResourceGroups} = this.state;

    let modalBody = null;
    if (syncData) {
      const {syncMode, syncPercent, resource} = syncData;
      const {resourceGroupId} = resource;
      modalBody = (
        <div>
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
            <button className="btn btn--super-duper-compact btn--outlined"
                    onClick={e => {
                      this.hide();
                      showModal(SyncLogsModal)
                    }}>
              View Debug Logs
            </button>
            <div>
              <select name="team" id="team" disabled="disabled">
                <option value="other">Coming soon...</option>
              </select>
            </div>
          </div>
        </div>
      )
    }

    return (
      <Modal ref={m => this.modal = m} tall={true} wide={true}>
        <ModalHeader>Sync Settings</ModalHeader>
        <ModalBody className="pad">
          {modalBody}
        </ModalBody>
        <ModalFooter>
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
