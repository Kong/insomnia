import React, {Component, PropTypes} from 'react';
import {Dropdown, DropdownDivider, DropdownItem, DropdownButton} from '../base/dropdown';
import {showModal} from '../modals';
import SyncLogsModal from '../modals/SyncLogsModal';
import * as syncStorage from '../../../sync/storage';
import * as session from '../../../sync/session';
import * as sync from '../../../sync';
import {trackEvent} from '../../../analytics';
import SettingsModal, {TAB_PLUS} from '../modals/SettingsModal';
import LoginModal from '../modals/LoginModal';
import PromptButton from '../base/PromptButton';

class SyncDropdown extends Component {
  state = {
    loggedIn: null,
    syncData: null,
    loading: false,
    hide: false,
  };

  _handleHideMenu () {
    this.setState({hide: true});
    trackEvent('Sync', 'Hide Menu')
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

    trackEvent('Sync', 'Change Mode', syncMode);
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
    const {className} = this.props;
    const {syncData, loading, loggedIn, hide} = this.state;

    if (hide) {
      return null;
    }

    if (!loggedIn) {
      return (
        <div className={className}>
          <Dropdown wide={true} className="wide tall">
            <DropdownButton className="btn btn--compact wide"
                            onClick={e => trackEvent('Sync', 'Show Menu', 'Guest')}>
              Sync Settings
            </DropdownButton>
            <DropdownDivider name="Insomnia Cloud Sync"/>
            <DropdownItem onClick={e => {
              showModal(SettingsModal, TAB_PLUS);
              trackEvent('Sync', 'Create Account');
            }}>
              <i className="fa fa-user"></i>
              Create Account
            </DropdownItem>
            <DropdownItem onClick={e => {
              showModal(LoginModal);
              trackEvent('Sync', 'Login');
            }}>
              <i className="fa fa-empty"></i>
              Login
            </DropdownItem>
            <DropdownDivider/>
            <DropdownItem buttonClass={PromptButton}
                          addIcon={true}
                          onClick={e => this._handleHideMenu()}>
              <i className="fa fa-eye-slash"></i>
              Hide This Menu
            </DropdownItem>
          </Dropdown>
        </div>
      )
    }

    if (!syncData) {
      return (
        <div className={className}>
          <button className="btn btn--compact wide" disabled={true}>
            Initializing Sync...
          </button>
        </div>
      )
    } else {
      const {resourceGroupId, syncMode, syncPercent} = syncData;
      const description = this._getSyncDescription(syncMode, syncPercent);

      return (
        <div className={className}>
          <Dropdown wide={true} className="wide tall">
            <DropdownButton className="btn btn--compact wide"
                            onClick={e => trackEvent('Sync', 'Show Menu', 'Authenticated')}>
              {description}
            </DropdownButton>
            <DropdownDivider name={`Workspace Synced ${syncPercent}%`}/>
            <DropdownItem onClick={e => this._handleToggleSyncMode(resourceGroupId)}
                          stayOpenAfterClick={true}>
              {syncMode === syncStorage.SYNC_MODE_OFF ?
                <i className="fa fa-toggle-off"></i> :
                <i className="fa fa-toggle-on"></i>}
              Automatic Sync
            </DropdownItem>
            <DropdownItem onClick={e => this._handleSyncResourceGroupId(resourceGroupId)}
                          disabled={syncPercent === 100}
                          stayOpenAfterClick={true}>
              {loading ?
                <i className="fa fa-refresh fa-spin"></i> :
                <i className="fa fa-cloud-upload"></i>}
              Sync Now {syncPercent === 100 ? '(up to date)' : ''}
            </DropdownItem>

            <DropdownDivider name="Other"/>

            <DropdownItem onClick={e => showModal(SettingsModal, TAB_PLUS)}>
              <i className="fa fa-user"></i>
              Manage Account
            </DropdownItem>
            <DropdownItem onClick={e => showModal(SyncLogsModal)}>
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
