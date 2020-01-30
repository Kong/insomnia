// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import Dropdown from '../base/dropdown/dropdown';
import DropdownDivider from '../base/dropdown/dropdown-divider';
import DropdownButton from '../base/dropdown/dropdown-button';
import DropdownItem from '../base/dropdown/dropdown-item';
import DropdownHint from '../base/dropdown/dropdown-hint';
import SettingsModal, { TAB_INDEX_EXPORT } from '../modals/settings-modal';
import * as models from '../../../models';
import { getAppName, getAppVersion } from '../../../common/constants';
import { showAlert, showModal, showPrompt } from '../modals';
import WorkspaceSettingsModal from '../modals/workspace-settings-modal';
import Tooltip from '../tooltip';
import KeydownBinder from '../keydown-binder';
import { hotKeyRefs } from '../../../common/hotkeys';
import { executeHotKey } from '../../../common/hotkeys-listener';
import type { Workspace } from '../../../models/workspace';
import type { HotKeyRegistry } from '../../../common/hotkeys';
import * as db from '../../../common/database';
import VCS from '../../../sync/vcs';
import type { Project } from '../../../sync/types';
import * as sync from '../../../sync-legacy/index';
import * as session from '../../../account/session';

type Props = {
  isLoading: boolean,
  handleSetActiveWorkspace: (id: string) => void,
  workspaces: Array<Workspace>,
  unseenWorkspaces: Array<Workspace>,
  activeWorkspace: Workspace,
  hotKeyRegistry: HotKeyRegistry,
  enableSyncBeta: boolean,
  vcs: VCS | null,

  // Optional
  className?: string,
};

type State = {
  remoteProjects: Array<Project>,
  localProjects: Array<Project>,
  pullingProjects: { [string]: boolean },
};

@autobind
class WorkspaceDropdown extends React.PureComponent<Props, State> {
  _dropdown: ?Dropdown;

  constructor(props: Props) {
    super(props);
    this.state = {
      remoteProjects: [],
      localProjects: [],
      pullingProjects: {},
    };
  }

  async _handleDropdownHide() {
    // Mark all unseen workspace as seen
    for (const workspace of this.props.unseenWorkspaces) {
      const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
      if (!workspaceMeta.hasSeen) {
        await models.workspaceMeta.update(workspaceMeta, { hasSeen: true });
      }
    }
  }

  async _handleDropdownOpen() {
    this._refreshRemoteWorkspaces();
  }

  async _refreshRemoteWorkspaces() {
    const { vcs } = this.props;
    if (!vcs) {
      return;
    }

    if (!session.isLoggedIn()) {
      return;
    }

    const remoteProjects = await vcs.remoteProjects();
    const localProjects = await vcs.localProjects();
    this.setState({ remoteProjects, localProjects });
  }

  async _handlePullRemoteWorkspace(project: Project) {
    const { vcs } = this.props;
    if (!vcs) {
      throw new Error('VCS is not defined');
    }

    this.setState(state => ({
      pullingProjects: { ...state.pullingProjects, [project.id]: true },
    }));

    try {
      // Clone old VCS so we don't mess anything up while working on other projects
      const newVCS = vcs.newInstance();

      // Remove all projects for workspace first
      await newVCS.removeProjectsForRoot(project.rootDocumentId);

      // Set project, checkout master, and pull
      await newVCS.setProject(project);
      await newVCS.checkout([], 'master');
      await newVCS.pull([]); // There won't be any existing docs since it's a new pull

      const flushId = await db.bufferChanges();
      for (const doc of await newVCS.allDocuments()) {
        await db.upsert(doc);
      }
      await db.flushChanges(flushId);
      await this._refreshRemoteWorkspaces();
    } catch (err) {
      this._dropdown && this._dropdown.hide();
      showAlert({
        title: 'Pull Error',
        message: `Failed to pull workspace. ${err.message}`,
      });
    }

    this.setState(state => ({
      pullingProjects: { ...state.pullingProjects, [project.id]: false },
    }));
  }

  _setDropdownRef(n: ?Dropdown) {
    this._dropdown = n;
  }

  static async _handleLogout() {
    await sync.logout();
  }

  static _handleShowExport() {
    showModal(SettingsModal, TAB_INDEX_EXPORT);
  }

  static _handleShowSettings() {
    showModal(SettingsModal);
  }

  static _handleShowWorkspaceSettings() {
    showModal(WorkspaceSettingsModal);
  }

  _handleWorkspaceCreate() {
    showPrompt({
      title: 'Create New Workspace',
      defaultValue: 'My Workspace',
      submitName: 'Create',
      selectText: true,
      onComplete: async name => {
        const workspace = await models.workspace.create({ name });
        this.props.handleSetActiveWorkspace(workspace._id);
      },
    });
  }

  _handleKeydown(e: KeyboardEvent) {
    executeHotKey(e, hotKeyRefs.TOGGLE_MAIN_MENU, () => {
      this._dropdown && this._dropdown.toggle(true);
    });
  }

  componentDidUpdate(prevProps: Props) {
    // Reload workspaces if we just got a new VCS instance
    if (this.props.vcs && !prevProps.vcs) {
      this._refreshRemoteWorkspaces();
    }
  }

  componentDidMount() {
    this._refreshRemoteWorkspaces();
  }

  render() {
    const {
      className,
      workspaces,
      activeWorkspace,
      unseenWorkspaces,
      isLoading,
      hotKeyRegistry,
      handleSetActiveWorkspace,
      enableSyncBeta,
      ...other
    } = this.props;

    const nonActiveWorkspaces = workspaces
      .filter(w => w._id !== activeWorkspace._id)
      .sort((w1, w2) => w1.name.localeCompare(w2.name));
    const addedWorkspaceNames = unseenWorkspaces.map(w => `"${w.name}"`).join(', ');
    const classes = classnames(className, 'wide', 'workspace-dropdown');

    const unseenWorkspacesMessage = (
      <div>
        The following workspaces were added
        <br />
        {addedWorkspaceNames}
      </div>
    );

    return (
      <KeydownBinder onKeydown={this._handleKeydown}>
        <Dropdown
          beside
          ref={this._setDropdownRef}
          className={classes}
          onOpen={this._handleDropdownOpen}
          onHide={this._handleDropdownHide}
          {...other}>
          <DropdownButton className="btn wide">
            <h1 className="no-pad text-left">
              <div className="pull-right">
                {isLoading ? <i className="fa fa-refresh fa-spin" /> : null}
                {unseenWorkspaces.length > 0 && (
                  <Tooltip message={unseenWorkspacesMessage} position="bottom">
                    <i className="fa fa-asterisk space-left" />
                  </Tooltip>
                )}
                <i className="fa fa-caret-down space-left" />
              </div>
              {activeWorkspace.name}
            </h1>
          </DropdownButton>
          <DropdownDivider>{activeWorkspace.name}</DropdownDivider>
          <DropdownItem onClick={WorkspaceDropdown._handleShowWorkspaceSettings}>
            <i className="fa fa-wrench" /> Workspace Settings
            <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.WORKSPACE_SHOW_SETTINGS.id]} />
          </DropdownItem>

          <DropdownDivider>Switch Workspace</DropdownDivider>

          {nonActiveWorkspaces.map(w => {
            const isUnseen = !!unseenWorkspaces.find(v => v._id === w._id);
            return (
              <DropdownItem key={w._id} onClick={handleSetActiveWorkspace} value={w._id}>
                <i className="fa fa-random" /> To <strong>{w.name}</strong>
                {isUnseen && (
                  <Tooltip message="You haven't seen this workspace before" position="top">
                    <i className="width-auto fa fa-asterisk surprise" />
                  </Tooltip>
                )}
              </DropdownItem>
            );
          })}

          <DropdownItem onClick={this._handleWorkspaceCreate}>
            <i className="fa fa-empty" /> Create Workspace
          </DropdownItem>

          <DropdownDivider>
            {getAppName()} v{getAppVersion()}
          </DropdownDivider>

          <DropdownItem onClick={WorkspaceDropdown._handleShowSettings}>
            <i className="fa fa-cog" /> Preferences
            <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.PREFERENCES_SHOW_GENERAL.id]} />
          </DropdownItem>
          <DropdownItem onClick={WorkspaceDropdown._handleShowExport}>
            <i className="fa fa-share" /> Import/Export
          </DropdownItem>
        </Dropdown>
      </KeydownBinder>
    );
  }
}

export default WorkspaceDropdown;
