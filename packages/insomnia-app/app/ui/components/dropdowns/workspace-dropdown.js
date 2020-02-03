// @flow
import * as React from 'react';
import * as git from 'isomorphic-git';
import YAML from 'yaml';
import path from 'path';
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
import { showAlert, showError, showModal, showPrompt } from '../modals';
import WorkspaceSettingsModal from '../modals/workspace-settings-modal';
import WorkspaceShareSettingsModal from '../modals/workspace-share-settings-modal';
import PortalUploadModal from '../modals/portal-upload-modal';
import Tooltip from '../tooltip';
import KeydownBinder from '../keydown-binder';
import type { HotKeyRegistry } from '../../../common/hotkeys';
import { hotKeyRefs } from '../../../common/hotkeys';
import { executeHotKey } from '../../../common/hotkeys-listener';
import type { Workspace } from '../../../models/workspace';
import SyncShareModal from '../modals/sync-share-modal';
import * as db from '../../../common/database';
import VCS from '../../../sync/vcs';
import HelpTooltip from '../help-tooltip';
import type { Project } from '../../../sync/types';
import * as sync from '../../../sync-legacy/index';
import * as session from '../../../account/session';
import { MemPlugin } from '../../../sync/git/mem-plugin';
import GitVCS from '../../../sync/git/git-vcs';
import GitRepositorySettingsModal from '../modals/git-repository-settings-modal';
import { trackEvent } from '../../../common/analytics';
import type { WorkspaceAction } from '../../../plugins';
import { getWorkspaceActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import type { Environment } from '../../../models/environment';

type Props = {|
  isLoading: boolean,
  handleSetActiveWorkspace: (id: string) => void,
  workspaces: Array<Workspace>,
  unseenWorkspaces: Array<Workspace>,
  activeEnvironment: Environment | null,
  activeWorkspace: Workspace,
  enableSyncBeta: boolean,
  handleSetActiveWorkspace: (id: string) => void,
  hotKeyRegistry: HotKeyRegistry,
  isLoading: boolean,
  unseenWorkspaces: Array<Workspace>,
  vcs: VCS | null,
  gitVCS: GitVCS | null,
  workspaces: Array<Workspace>,

  // Optional
  className?: string,
|};

type State = {
  remoteProjects: Array<Project>,
  localProjects: Array<Project>,
  pullingProjects: { [string]: boolean },
  actionPlugins: Array<WorkspaceAction>,
  loadingActions: { [string]: boolean },
  localProjects: Array<Project>,
  pullingProjects: { [string]: boolean },
  remoteProjects: Array<Project>,
};

@autobind
class WorkspaceDropdown extends React.PureComponent<Props, State> {
  _dropdown: ?Dropdown;

  state = {
    actionPlugins: [],
    loadingActions: {},
    localProjects: [],
    pullingProjects: {},
    remoteProjects: [],
  };

  async _handlePluginClick(p: WorkspaceAction) {
    this.setState(state => ({ loadingActions: { ...state.loadingActions, [p.label]: true } }));

    const { activeEnvironment, activeWorkspace } = this.props;

    try {
      const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : null;

      const context = {
        ...pluginContexts.app.init(RENDER_PURPOSE_NO_RENDER),
        ...pluginContexts.data.init(),
        ...pluginContexts.store.init(p.plugin),
        ...pluginContexts.network.init(activeEnvironmentId),
      };

      const docs = await db.withDescendants(activeWorkspace);
      const requests: any = docs.filter(d => d.type === models.request.type && !(d: any).isPrivate);
      const requestGroups: any = docs.filter(d => d.type === models.requestGroup.type);

      await p.action(context, { requestGroups, requests, workspace: activeWorkspace });
    } catch (err) {
      showError({
        title: 'Plugin Action Failed',
        error: err,
      });
    }

    this.setState(state => ({ loadingActions: { ...state.loadingActions, [p.label]: false } }));
    this._dropdown && this._dropdown.hide();
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

    // Load action plugins
    const plugins = await getWorkspaceActions();
    this.setState({ actionPlugins: plugins });
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

  _handleShowShareSettings() {
    if (this.props.enableSyncBeta) {
      showModal(SyncShareModal);
    } else {
      showModal(WorkspaceShareSettingsModal);
    }
  }

  _handlePortalUpload() {
    showModal(PortalUploadModal, {});
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

        trackEvent('Workspace', 'Create');
      },
    });
  }

  async _handleWorkspaceClone() {
    // This is a huge flow and we don't really have anywhere to put something like this. I guess
    // it's fine here for now (?)
    showModal(GitRepositorySettingsModal, {
      gitRepository: null,
      onSubmitEdits: async repoSettingsPatch => {
        trackEvent('Git', 'Clone');

        const core = Math.random() + '';
        const studioDirname = '.studio';
        const studioRoot = path.join('/', studioDirname);

        // Create in-memory filesystem to perform clone
        const plugins = git.cores.create(core);
        const fsPlugin = MemPlugin.createPlugin();
        plugins.set('fs', fsPlugin);

        // Pull settings returned from dialog and shallow-clone the repo
        const { credentials, uri: url } = repoSettingsPatch;
        const token = credentials ? credentials.token : null;
        await git.clone({ core, dir: '/', singleBranch: true, url, token, depth: 1 });

        const f = fsPlugin.promises;
        const ensureDir = async (base: string, name: string): Promise<boolean> => {
          const rootDirs = await f.readdir(base);
          if (rootDirs.includes(name)) {
            return true;
          }

          showAlert({
            title: 'Clone Problem',
            message: (
              <React.Fragment>
                Could not locate{' '}
                <code>
                  {base}/{name}
                </code>{' '}
                directory in repository.
              </React.Fragment>
            ),
          });

          return false;
        };

        if (!(await ensureDir('/', studioDirname))) {
          return;
        }

        if (!(await ensureDir(studioRoot, models.workspace.type))) {
          return;
        }

        const workspaceBase = path.join(studioRoot, models.workspace.type);
        const workspaceDirs = await f.readdir(workspaceBase);

        if (workspaceDirs.length > 1) {
          return showAlert({
            title: 'Clone Problem',
            message: 'Multiple workspaces found in repository',
          });
        }

        if (workspaceDirs.length === 0) {
          return showAlert({
            title: 'Clone Problem',
            message: 'No workspaces found in repository',
          });
        }

        const workspacePath = path.join(workspaceBase, workspaceDirs[0]);
        const workspaceJson = await f.readFile(workspacePath);
        const workspace = YAML.parse(workspaceJson.toString());

        // Check if the workspace already exists
        const existingWorkspace = await models.workspace.getById(workspace._id);

        if (existingWorkspace) {
          return showAlert({
            title: 'Clone Problem',
            okLabel: 'Done',
            message: (
              <React.Fragment>
                Workspace <strong>{existingWorkspace.name}</strong> already exists in Studio. Please
                delete it before cloning.
              </React.Fragment>
            ),
          });
        }

        // Prompt user to confirm importing the workspace
        showAlert({
          title: 'Project Found',
          okLabel: 'Import',
          message: (
            <React.Fragment>
              Workspace <strong>{workspace.name}</strong> found in repository. Would you like to
              import it?
            </React.Fragment>
          ),

          // Import all docs to the DB
          onConfirm: async () => {
            const { handleSetActiveWorkspace } = this.props;

            // Stop the DB from pushing updates to the UI temporarily
            const bufferId = await db.bufferChanges();

            // Loop over all model folders in .studio/
            for (const modelType of await f.readdir(studioRoot)) {
              const modelDir = path.join(studioRoot, modelType);

              // Loop over all documents in model folder and save them
              for (const docFileName of await f.readdir(modelDir)) {
                const docPath = path.join(modelDir, docFileName);
                const docYaml = await f.readFile(docPath);
                const doc = YAML.parse(docYaml.toString());
                await db.upsert(doc);
              }
            }

            // Store GitRepository settings and set it as active
            const newRepo = await models.gitRepository.create({
              ...repoSettingsPatch,
              needsFullClone: true,
            });
            const meta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
            await models.workspaceMeta.update(meta, { gitRepositoryId: newRepo._id });

            // Activate the workspace after importing everything
            await handleSetActiveWorkspace(workspace._id);

            // Flush DB changes
            await db.flushChanges(bufferId);
          },
        });
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

    const { remoteProjects, localProjects, pullingProjects } = this.state;

    const missingRemoteProjects = remoteProjects.filter(({ id, rootDocumentId }) => {
      const localProjectExists = localProjects.find(p => p.id === id);
      const workspaceExists = workspaces.find(w => w._id === rootDocumentId);

      // Mark as missing if:
      //   - the project doesn't yet exists locally
      //   - the project exists locally but somehow the workspace doesn't anymore
      return !(workspaceExists && localProjectExists);
    });

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

    const { actionPlugins, loadingActions } = this.state;

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
          <DropdownItem onClick={this._handlePortalUpload}>
            <i className="fa fa-cloud-upload" /> Deploy to <strong>Kong Portal</strong>
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

          <DropdownItem onClick={this._handleWorkspaceClone}>
            <i className="fa fa-empty" /> Clone from Git
          </DropdownItem>

          {missingRemoteProjects.length > 0 && (
            <DropdownDivider>
              Remote Workspaces{' '}
              <HelpTooltip>
                These workspaces have been shared with you via Insomnia Sync and do not yet exist on
                your machine.
              </HelpTooltip>
            </DropdownDivider>
          )}

          {missingRemoteProjects.map(p => (
            <DropdownItem
              key={p.id}
              stayOpenAfterClick
              onClick={() => this._handlePullRemoteWorkspace(p)}>
              {pullingProjects[p.id] ? (
                <i className="fa fa-refresh fa-spin" />
              ) : (
                <i className="fa fa-cloud-download" />
              )}
              Pull <strong>{p.name}</strong>
            </DropdownItem>
          ))}

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
