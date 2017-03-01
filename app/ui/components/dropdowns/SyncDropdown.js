import React, {PureComponent, PropTypes} from 'react';
import {Dropdown, DropdownDivider, DropdownItem, DropdownButton} from '../base/dropdown';
import {showModal} from '../modals';
import SyncLogsModal from '../modals/SyncLogsModal';
import * as syncStorage from '../../../sync/storage';
import * as session from '../../../sync/session';
import * as sync from '../../../sync';
import {trackEvent} from '../../../analytics';
import WorkspaceShareSettingsModal from '../modals/WorkspaceShareSettingsModal';

class SyncDropdown extends PureComponent {
  state = {
    loggedIn: null,
    syncData: null,
    loading: false,
  };

  _trackShowMenu = () => trackEvent('Sync', 'Show Menu', 'Authenticated');
  _handleShowLogs = () => showModal(SyncLogsModal);

  _handleShowShareSettings = () => {
    showModal(WorkspaceShareSettingsModal, {workspace: this.props.workspace});
  };

  _handleToggleSyncMode = async () => {
    const {syncData} = this.state;
    const resourceGroupId = syncData.resourceGroupId;

    const config = await sync.getOrCreateConfig(resourceGroupId);

    let syncMode = config.syncMode === syncStorage.SYNC_MODE_OFF ?
      syncStorage.SYNC_MODE_ON : syncStorage.SYNC_MODE_OFF;

    await sync.createOrUpdateConfig(resourceGroupId, syncMode);

    await this._reloadData();

    // Trigger a sync right away if we're turning it on
    if (syncMode === syncStorage.SYNC_MODE_ON) {
      await this._handleSyncResourceGroupId();
    }

    trackEvent('Sync', 'Change Mode', syncMode);
  };

  _handleSyncResourceGroupId = async () => {
    const {syncData} = this.state;
    const resourceGroupId = syncData.resourceGroupId;

    // Set loading state
    this.setState({loading: true});

    await sync.getOrCreateConfig(resourceGroupId);
    await sync.pull(resourceGroupId);
    await sync.push(resourceGroupId);

    await this._reloadData();

    // Unset loading state
    this.setState({loading: false});

    trackEvent('Sync', 'Manual Sync');
  };

  async _reloadData () {
    const loggedIn = session.isLoggedIn();

    if (loggedIn !== this.state.loggedIn) {
      this.setState({loggedIn});
    }

    if (!loggedIn) {
      return;
    }

    // Get or create any related sync data
    const {workspace} = this.props;
    const {resourceGroupId} = await sync.getOrCreateResourceForDoc(workspace);
    const config = await sync.getOrCreateConfig(resourceGroupId);

    // Analyze it
    const dirty = await syncStorage.findDirtyResourcesForResourceGroup(resourceGroupId);
    const all = await syncStorage.findResourcesForResourceGroup(resourceGroupId);
    const numClean = all.length - dirty.length;
    const syncPercent = all.length === 0 ? 100 : parseInt(numClean / all.length * 1000) / 10;

    const syncData = {
      resourceGroupId,
      syncPercent,
      syncMode: config.syncMode,
      name: workspace.name,
    };

    this.setState({syncData});
  }

  componentWillMount () {
    this._interval = setInterval(() => this._reloadData(), 2000);
    this._reloadData();
  }

  componentWillUnmount () {
    clearInterval(this._interval);
  }

  _getSyncDescription (syncMode, syncPercentage) {
    if (syncPercentage === 100) {
      return 'Up To Date'
    } else {
      return syncMode === syncStorage.SYNC_MODE_ON ? 'Sync Pending' : 'Sync Required'
    }
  }

  render () {
    const {className, workspace} = this.props;
    const {syncData, loading, loggedIn} = this.state;

    // Don't show the sync menu unless we're logged in
    if (!loggedIn) {
      return null;
    }

    if (!syncData) {
      return (
        <div className={className}>
          <button className="btn btn--compact wide" disabled>
            Initializing Sync...
          </button>
        </div>
      )
    } else {
      const {syncMode, syncPercent} = syncData;
      const description = this._getSyncDescription(syncMode, syncPercent);
      const isPaused = syncMode === syncStorage.SYNC_MODE_OFF;

      return (
        <div className={className}>
          <Dropdown wide className="wide tall">
            <DropdownButton className="btn btn--compact wide" onClick={this._trackShowMenu}>
              {isPaused ? <span><i className="fa fa-pause-circle"/>&nbsp;</span> : null}
              {description}
            </DropdownButton>
            <DropdownDivider>Workspace Synced {syncPercent}%</DropdownDivider>
            <DropdownItem onClick={this._handleToggleSyncMode} stayOpenAfterClick>
              {syncMode === syncStorage.SYNC_MODE_OFF ?
                <i className="fa fa-toggle-off"></i> :
                <i className="fa fa-toggle-on"></i>}
              Automatic Sync
            </DropdownItem>
            <DropdownItem onClick={this._handleSyncResourceGroupId} stayOpenAfterClick>
              {loading ?
                <i className="fa fa-refresh fa-spin"></i> :
                <i className="fa fa-cloud-upload"></i>}
              Sync Now
            </DropdownItem>

            <DropdownDivider>Other</DropdownDivider>
            <DropdownItem onClick={this._handleShowShareSettings}>
              <i className="fa fa-users"></i>
              Configure Sharing
            </DropdownItem>
            <DropdownItem onClick={this._handleShowLogs}>
              <i className="fa fa-bug"></i>
              Show Debug Logs
            </DropdownItem>
          </Dropdown>
        </div>
      );
    }
  }
}

SyncDropdown.propTypes = {
  workspace: PropTypes.object.isRequired
};

export default SyncDropdown;
