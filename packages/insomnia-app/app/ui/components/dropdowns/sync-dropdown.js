// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import { showModal } from '../modals';
import * as syncStorage from '../../../sync/storage';
import * as session from '../../../sync/session';
import * as sync from '../../../sync';
import WorkspaceShareSettingsModal from '../modals/workspace-share-settings-modal';
import SetupSyncModal from '../modals/setup-sync-modal';
import type { Workspace } from '../../../models/workspace';

type Props = {
  workspace: Workspace,

  // Optional
  className?: string
};

type State = {
  loggedIn: boolean | null,
  loading: boolean,
  resourceGroupId: string | null,
  syncMode: string | null,
  syncPercent: number,
  workspaceName: string
};

@autobind
class SyncDropdown extends React.PureComponent<Props, State> {
  _hasPrompted: boolean;
  _isMounted: boolean;

  constructor(props: Props) {
    super(props);

    this._hasPrompted = false;
    this._isMounted = false;

    this.state = {
      loggedIn: null,
      loading: false,
      resourceGroupId: null,
      syncMode: null,
      syncPercent: 0,
      workspaceName: ''
    };
  }

  _handleShowShareSettings() {
    showModal(WorkspaceShareSettingsModal, { workspace: this.props.workspace });
  }

  async _handleSyncResourceGroupId() {
    const { resourceGroupId } = this.state;

    // Set loading state
    this.setState({ loading: true });

    await sync.getOrCreateConfig(resourceGroupId);
    await sync.pull(resourceGroupId);
    await sync.push(resourceGroupId);

    await this._reloadData();

    // Unset loading state
    this.setState({ loading: false });
  }

  async _reloadData() {
    const loggedIn = session.isLoggedIn();

    if (loggedIn !== this.state.loggedIn) {
      this.setState({ loggedIn });
    }

    if (!loggedIn) {
      return;
    }

    // Get or create any related sync data
    const { workspace } = this.props;
    const { resourceGroupId } = await sync.getOrCreateResourceForDoc(workspace);
    const config = await sync.getOrCreateConfig(resourceGroupId);

    // Analyze it
    const dirty = await syncStorage.findDirtyResourcesForResourceGroup(resourceGroupId);
    const all = await syncStorage.findResourcesForResourceGroup(resourceGroupId);
    const numClean = all.length - dirty.length;
    const syncPercent = all.length === 0 ? 100 : parseInt((numClean / all.length) * 1000) / 10;

    if (this._isMounted) {
      this.setState({
        resourceGroupId,
        syncPercent,
        syncMode: config.syncMode,
        workspaceName: workspace.name
      });
    }
  }

  async _handleShowSyncModePrompt() {
    showModal(SetupSyncModal, {
      onSelectSyncMode: async syncMode => {
        await this._reloadData();
      }
    });
  }

  componentDidMount() {
    this._isMounted = true;
    syncStorage.onChange(this._reloadData);
    this._reloadData();
  }

  componentWillUnmount() {
    syncStorage.offChange(this._reloadData);
    this._isMounted = false;
  }

  componentDidUpdate() {
    const { resourceGroupId, syncMode } = this.state;

    if (!resourceGroupId) {
      return;
    }

    // Sync has not yet been configured for this workspace, so prompt the user to do so
    const isModeUnset = !syncMode || syncMode === syncStorage.SYNC_MODE_UNSET;
    if (isModeUnset && !this._hasPrompted) {
      this._hasPrompted = true;
      this._handleShowSyncModePrompt();
    }
  }

  _getSyncDescription(syncMode: string | null, syncPercentage: number) {
    let el = null;
    if (syncMode === syncStorage.SYNC_MODE_NEVER) {
      el = <span>Sync Disabled</span>;
    } else if (syncPercentage === 100) {
      el = <span>Sync Up To Date</span>;
    } else if (syncMode === syncStorage.SYNC_MODE_OFF) {
      el = (
        <span>
          <i className="fa fa-pause-circle-o" /> Sync Required
        </span>
      );
    } else if (syncMode === syncStorage.SYNC_MODE_ON) {
      el = <span>Sync Pending</span>;
    } else if (!syncMode || syncMode === syncStorage.SYNC_MODE_UNSET) {
      el = (
        <span>
          <i className="fa fa-exclamation-circle" /> Configure Sync
        </span>
      );
    }

    return el;
  }

  render() {
    const { className } = this.props;
    const { resourceGroupId, loading, loggedIn } = this.state;

    // Don't show the sync menu unless we're logged in
    if (!loggedIn) {
      return null;
    }

    if (!resourceGroupId) {
      return (
        <div className={className}>
          <button className="btn btn--compact wide" disabled>
            Initializing Sync...
          </button>
        </div>
      );
    } else {
      const { syncMode, syncPercent } = this.state;
      return (
        <div className={className}>
          <Dropdown wide className="wide tall">
            <DropdownButton className="btn btn--compact wide">
              {this._getSyncDescription(syncMode, syncPercent)}
            </DropdownButton>
            <DropdownDivider>Workspace Synced {syncPercent}%</DropdownDivider>

            <DropdownItem onClick={this._handleShowSyncModePrompt}>
              <i className="fa fa-wrench" />
              Change Sync Mode
            </DropdownItem>

            {/* SYNCED */}

            {syncMode !== syncStorage.SYNC_MODE_NEVER ? (
              <DropdownItem onClick={this._handleSyncResourceGroupId} stayOpenAfterClick>
                {loading ? (
                  <i className="fa fa-refresh fa-spin" />
                ) : (
                  <i className="fa fa-cloud-upload" />
                )}
                Sync Now
              </DropdownItem>
            ) : null}

            {syncMode !== syncStorage.SYNC_MODE_NEVER ? (
              <DropdownItem onClick={this._handleShowShareSettings}>
                <i className="fa fa-users" />
                Share Settings
              </DropdownItem>
            ) : null}
          </Dropdown>
        </div>
      );
    }
  }
}

export default SyncDropdown;
