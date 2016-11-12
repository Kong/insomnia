import React, {Component, PropTypes} from 'react';
import {Dropdown, DropdownDivider, DropdownItem, DropdownButton} from '../base/dropdown';
import {showModal} from '../modals/index';
import SignupModal from '../modals/SignupModal';
import SyncLogsModal from '../modals/SyncLogsModal';
import * as syncStorage from '../../../sync/storage';
import * as session from '../../../sync/session';
import * as sync from '../../../sync';
import * as analytics from '../../../analytics/index';
import * as models from '../../../models/index';

class SyncDropdown extends Component {
  constructor (props) {
    super(props);
    this.state = {
      syncData: null,
      loading: false,
    }
  }

  async _handleToggleSyncMode (resourceGroupId) {
    const config = await sync.getOrCreateConfig(resourceGroupId);

    let syncMode = config.syncMode === syncStorage.SYNC_MODE_OFF ?
      syncStorage.SYNC_MODE_ON : syncStorage.SYNC_MODE_OFF;

    await sync.createOrUpdateConfig(resourceGroupId, syncMode);

    await this._reloadData();

    // Trigger a sync right away if we're turning it on
    if (syncMode === syncStorage.SYNC_MODE_ON) {
      await this._handleSyncResourceGroupId(resourceGroupId);
    }

    analytics.trackEvent('Sync', 'Change Mode', syncMode);
  }

  async _handleSyncResourceGroupId (resourceGroupId) {
    // Set loading state
    this.setState({loading: true});

    await sync.getOrCreateConfig(resourceGroupId);
    await sync.pull(resourceGroupId);
    await sync.pushActiveDirtyResources(resourceGroupId);

    await this._reloadData();

    // Unset loading state
    this.setState({loading: false});

    analytics.trackEvent('Sync', 'Manual Sync');
  }

  async _reloadData () {
    // Get or create any related sync data
    const workspace = await models.workspace.getById(this.props.workspaceId);
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
    }

    if (syncMode === syncStorage.SYNC_MODE_ON) {
      return 'Pending'
    } else {
      return 'Sync Required'
    }
  }

  render () {
    const {syncData, loading} = this.state;
    if (syncData && session.isLoggedIn()) {
      const {resource, syncMode, syncPercent} = syncData;
      const description = this._getSyncDescription(syncMode, syncPercent);
      return (
        <Dropdown wide={true} className="wide tall">
          <DropdownButton className="btn btn--compact wide">
            {description}
          </DropdownButton>
          <DropdownDivider name={`Workspace Synced ${syncPercent}%`}/>
          <DropdownItem onClick={e => this._handleToggleSyncMode(resource.resourceGroupId)}
                        stayOpenAfterClick={true}>
            {syncMode === syncStorage.SYNC_MODE_OFF ? (
              <i className="fa fa-toggle-off"></i>
            ) : (
              <i className="fa fa-toggle-on"></i>
            )}
            Sync Automatically
          </DropdownItem>
          <DropdownItem>
            <i className="fa fa-share-alt"></i>
            Share Workspace
          </DropdownItem>
          <DropdownDivider name="Other"/>
          <DropdownItem onClick={e => this._handleSyncResourceGroupId(resource.resourceGroupId)}
                        disabled={syncPercent === 100}
                        stayOpenAfterClick={true}>
            {loading ?
              <i className="fa fa-refresh fa-spin"></i> :
              <i className="fa fa-cloud-upload"></i>}
            Sync Now {syncPercent === 100 ? '(up to date)' : ''}
          </DropdownItem>
          <DropdownItem onClick={e => showModal(SyncLogsModal)}>
            <i className="fa fa-bug"></i>
            Debug Logs
          </DropdownItem>
        </Dropdown>
      );
    } else if (!syncData) {
      return null;
    } else {
      return (
        <button className="btn btn--super-duper-compact btn--outlined wide"
                onClick={e => showModal(SignupModal)}>
          Login to Cloud Sync
        </button>
      )
    }
  }
}

SyncDropdown.propTypes = {
  workspaceId: PropTypes.string.isRequired
};

export default SyncDropdown;
