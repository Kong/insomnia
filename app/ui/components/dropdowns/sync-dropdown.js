import React, {PureComponent, PropTypes} from 'react';
import autobind from 'autobind-decorator';
import {Dropdown, DropdownDivider, DropdownItem, DropdownButton} from '../base/dropdown';
import {showModal} from '../modals';
import * as syncStorage from '../../../sync/storage';
import * as session from '../../../sync/session';
import * as sync from '../../../sync';
import {trackEvent} from '../../../analytics';
import WorkspaceShareSettingsModal from '../modals/workspace-share-settings-modal';
import SetupSyncModal from '../modals/setup-sync-modal';

@autobind
class SyncDropdown extends PureComponent {
  constructor (props) {
    super(props);

    this._hasPrompted = false;

    this.state = {
      loggedIn: null,
      syncData: null,
      loading: false
    };
  }

  _trackShowMenu () {
    trackEvent('Sync', 'Show Menu', 'Authenticated');
  }

  _handleShowShareSettings () {
    showModal(WorkspaceShareSettingsModal, {workspace: this.props.workspace});
  }

  async _handleSyncResourceGroupId () {
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
  }

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
      name: workspace.name
    };

    this.setState({syncData});
  }

  async _handleShowSyncModePrompt () {
    await showModal(SetupSyncModal);
    await this._reloadData();
  }

  async componentWillMount () {
    this._interval = setInterval(this._reloadData, 500);
    await this._reloadData();
  }

  componentWillUnmount () {
    clearInterval(this._interval);
  }

  async componentDidUpdate () {
    const {syncData} = this.state;

    if (!syncData) {
      return;
    }

    // Sync has not yet been configured for this workspace, so prompt the user to do so
    const isModeUnset = syncData.syncMode === syncStorage.SYNC_MODE_UNSET;
    if (isModeUnset && !this._hasPrompted) {
      this._hasPrompted = true;
      await this._handleShowSyncModePrompt();
    }
  }

  _getSyncDescription (syncMode, syncPercentage) {
    let el = null;
    if (syncMode === syncStorage.SYNC_MODE_NEVER) {
      el = <span>Sync Disabled</span>;
    } else if (syncPercentage === 100) {
      el = <span>Sync Up To Date</span>;
    } else if (syncMode === syncStorage.SYNC_MODE_OFF) {
      el = <span><i className="fa fa-pause-circle-o"/> Sync Required</span>;
    } else if (syncMode === syncStorage.SYNC_MODE_ON) {
      el = <span>Sync Pending</span>;
    } else if (syncMode === syncStorage.SYNC_MODE_UNSET) {
      el = <span><i className="fa fa-exclamation-circle"/> Configure Sync</span>;
    }

    return el;
  }

  render () {
    const {className} = this.props;
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
      );
    } else {
      const {syncMode, syncPercent} = syncData;
      return (
        <div className={className}>
          <Dropdown wide className="wide tall">
            <DropdownButton className="btn btn--compact wide" onClick={this._trackShowMenu}>
              {this._getSyncDescription(syncMode, syncPercent)}
            </DropdownButton>
            <DropdownDivider>Workspace Synced {syncPercent}%</DropdownDivider>

            <DropdownItem onClick={this._handleShowSyncModePrompt}>
              <i className="fa fa-wrench"/>
              Change Sync Mode
            </DropdownItem>

            {/* SYNCED */}

            {syncMode !== syncStorage.SYNC_MODE_NEVER
              ? <DropdownItem onClick={this._handleSyncResourceGroupId} stayOpenAfterClick>
                {loading
                  ? <i className="fa fa-refresh fa-spin"/>
                  : <i className="fa fa-cloud-upload"/>}
                Sync Now
              </DropdownItem> : null
            }

            {syncMode !== syncStorage.SYNC_MODE_NEVER
              ? <DropdownItem onClick={this._handleShowShareSettings}>
                <i className="fa fa-users"></i>
                Share Settings
              </DropdownItem> : null
            }
          </Dropdown>
        </div>
      );
    }
  }
}

SyncDropdown.propTypes = {
  // Required
  workspace: PropTypes.object.isRequired,

  // Optional
  className: PropTypes.string
};

export default SyncDropdown;
