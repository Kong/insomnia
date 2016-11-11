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
import * as misc from '../../../common/misc';

class SyncDropdown extends Component {
  constructor (props) {
    super(props);
    this.state = {
      syncData: null,
      workspace: null,
      loading: false,
    }
  }

  async _handleSyncResourceGroupId (syncData) {
    const {resourceGroupId} = syncData.resource;

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

    this.setState({syncData, workspace});
  }

  componentWillMount () {
    this._interval = setInterval(() => this._reloadData(), 2000);
    this._reloadData();
  }

  componentWillUnmount () {
    clearInterval(this._interval);
  }

  render () {
    const {syncData, workspace, loading} = this.state;
    if (syncData && session.isLoggedIn()) {
      return (
        <Dropdown wide={true} className="wide tall">
          <DropdownButton className="btn btn--compact wide">
            {syncData.syncPercent === 100 ? 'Synced' : `Syncing...`}
          </DropdownButton>
          <DropdownDivider name={`Workspace Synced ${syncData.syncPercent}%`}/>
          {syncData.resource.resourceGroupId ? (
            <DropdownItem onClick={e => this._handleSyncResourceGroupId(syncData)}
                          stayOpenAfterClick={true}>
              {loading ?
                <i className="fa fa-refresh fa-spin"></i> :
                <i className="fa fa-cloud-upload"></i>
              }
              Force Sync
            </DropdownItem>
          ) : null}
          <DropdownItem>
            <i className="fa fa-share-alt"></i>
            Hello
          </DropdownItem>
          <DropdownDivider name="hello"/>
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
