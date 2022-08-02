import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { ipcRenderer } from 'electron';
import * as path from 'path';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { Action, bindActionCreators, Dispatch } from 'redux';
import { parse as urlParse } from 'url';

import { SegmentEvent, trackSegmentEvent } from '../../common/analytics';
import {
  ACTIVITY_HOME,
  AUTOBIND_CFG,
  getProductName,
  isDevelopment,
} from '../../common/constants';
import { type ChangeBufferEvent, database as db } from '../../common/database';
import { getDataDirectory } from '../../common/electron-helpers';
import { hotKeyRefs } from '../../common/hotkeys';
import { executeHotKey } from '../../common/hotkeys-listener';
import {
  generateId,
} from '../../common/misc';
import * as models from '../../models';
import { isEnvironment } from '../../models/environment';
import { GrpcRequest, isGrpcRequest } from '../../models/grpc-request';
import { getByParentId as getGrpcRequestMetaByParentId } from '../../models/grpc-request-meta';
import * as requestOperations from '../../models/helpers/request-operations';
import { isNotDefaultProject } from '../../models/project';
import { Request, updateMimeType } from '../../models/request';
import { type RequestGroupMeta } from '../../models/request-group-meta';
import { getByParentId as getRequestMetaByParentId } from '../../models/request-meta';
import { isWorkspace } from '../../models/workspace';
import * as plugins from '../../plugins';
import * as themes from '../../plugins/misc';
import { fsClient } from '../../sync/git/fs-client';
import { GIT_CLONE_DIR, GIT_INSOMNIA_DIR, GIT_INTERNAL_DIR, GitVCS } from '../../sync/git/git-vcs';
import { NeDBClient } from '../../sync/git/ne-db-client';
import { routableFSClient } from '../../sync/git/routable-fs-client';
import FileSystemDriver from '../../sync/store/drivers/file-system-driver';
import { type MergeConflict } from '../../sync/types';
import { VCS } from '../../sync/vcs/vcs';
import * as templating from '../../templating/index';
import { ErrorBoundary } from '../components/error-boundary';
import { KeydownBinder } from '../components/keydown-binder';
import { AskModal } from '../components/modals/ask-modal';
import { showCookiesModal } from '../components/modals/cookies-modal';
import { GenerateCodeModal } from '../components/modals/generate-code-modal';
import { showAlert, showModal, showPrompt } from '../components/modals/index';
import { RequestSettingsModal } from '../components/modals/request-settings-modal';
import RequestSwitcherModal from '../components/modals/request-switcher-modal';
import { showSelectModal } from '../components/modals/select-modal';
import { SettingsModal, TAB_INDEX_SHORTCUTS } from '../components/modals/settings-modal';
import { SyncMergeModal } from '../components/modals/sync-merge-modal';
import { WorkspaceEnvironmentsEditModal } from '../components/modals/workspace-environments-edit-modal';
import { WorkspaceSettingsModal } from '../components/modals/workspace-settings-modal';
import { Toast } from '../components/toast';
import { type WrapperClass, Wrapper } from '../components/wrapper';
import withDragDropContext from '../context/app/drag-drop-context';
import { GrpcProvider } from '../context/grpc';
import { NunjucksEnabledProvider } from '../context/nunjucks/nunjucks-enabled-context';
import { updateRequestMetaByParentId } from '../hooks/create-request';
import { createRequestGroup } from '../hooks/create-request-group';
import { RootState } from '../redux/modules';
import {
  newCommand,
} from '../redux/modules/global';
import { importUri } from '../redux/modules/import';
import {
  selectActiveActivity,
  selectActiveApiSpec,
  selectActiveCookieJar,
  selectActiveEnvironment,
  selectActiveGitRepository,
  selectActiveProject,
  selectActiveRequest,
  selectActiveWorkspace,
  selectActiveWorkspaceMeta,
  selectActiveWorkspaceName,
  selectEnvironments,
  selectIsFinishedBooting,
  selectIsLoggedIn,
  selectSettings,
} from '../redux/selectors';
import { AppHooks } from './app-hooks';

export type AppProps = ReturnType<typeof mapStateToProps> & ReturnType<typeof mapDispatchToProps>;

interface State {
  vcs: VCS | null;
  gitVCS: GitVCS | null;
  forceRefreshCounter: number;
  forceRefreshHeaderCounter: number;
  isMigratingChildren: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class App extends PureComponent<AppProps, State> {
  private _globalKeyMap: any;
  private _updateVCSLock: any;
  private _wrapper: WrapperClass | null = null;
  private _responseFilterHistorySaveTimeout: NodeJS.Timeout | null = null;

  constructor(props: AppProps) {
    super(props);

    this.state = {
      vcs: null,
      gitVCS: null,
      forceRefreshCounter: 0,
      forceRefreshHeaderCounter: 0,
      isMigratingChildren: false,
    };

    this._globalKeyMap = null;
    this._updateVCSLock = null;
  }

  _setGlobalKeyMap() {
    this._globalKeyMap = [
      [
        hotKeyRefs.PREFERENCES_SHOW_GENERAL,
        () => {
          App._handleShowSettingsModal();
        },
      ],
      [
        hotKeyRefs.PREFERENCES_SHOW_KEYBOARD_SHORTCUTS,
        () => {
          App._handleShowSettingsModal(TAB_INDEX_SHORTCUTS);
        },
      ],
      [
        hotKeyRefs.SHOW_RECENT_REQUESTS,
        () => {
          showModal(RequestSwitcherModal, {
            disableInput: true,
            maxRequests: 10,
            maxWorkspaces: 0,
            selectOnKeyup: true,
            title: 'Recent Requests',
            hideNeverActiveRequests: true,
            // Add an open delay so the dialog won't show for quick presses
            openDelay: 150,
          });
        },
      ],
      [
        hotKeyRefs.WORKSPACE_SHOW_SETTINGS,
        () => {
          const { activeWorkspace } = this.props;
          showModal(WorkspaceSettingsModal, activeWorkspace);
        },
      ],
      [
        hotKeyRefs.REQUEST_SHOW_SETTINGS,
        () => {
          if (this.props.activeRequest) {
            showModal(RequestSettingsModal, {
              request: this.props.activeRequest,
            });
          }
        },
      ],
      [
        hotKeyRefs.REQUEST_QUICK_SWITCH,
        () => {
          showModal(RequestSwitcherModal);
        },
      ],
      [
        hotKeyRefs.ENVIRONMENT_SHOW_EDITOR,
        () => {
          const { activeWorkspace } = this.props;
          showModal(WorkspaceEnvironmentsEditModal, activeWorkspace);
        },
      ],
      [hotKeyRefs.SHOW_COOKIES_EDITOR, showCookiesModal],
      [
        hotKeyRefs.REQUEST_CREATE_HTTP,
        async () => {
          const { activeRequest, activeWorkspace } = this.props;
          if (!activeWorkspace) {
            return;
          }

          const parentId = activeRequest ? activeRequest.parentId : activeWorkspace._id;
          const request = await models.request.create({
            parentId,
            name: 'New Request',
          });
          await this._handleSetActiveRequest(request._id);
          models.stats.incrementCreatedRequests();
          trackSegmentEvent(SegmentEvent.requestCreate, { requestType: 'HTTP' });
        },
      ],
      [
        hotKeyRefs.REQUEST_SHOW_DELETE,
        () => {
          const { activeRequest } = this.props;

          if (!activeRequest) {
            return;
          }

          showModal(AskModal, {
            title: 'Delete Request?',
            message: `Really delete ${activeRequest.name}?`,
            onDone: async (confirmed: boolean) => {
              if (!confirmed) {
                return;
              }

              await requestOperations.remove(activeRequest);
              models.stats.incrementDeletedRequests();
            },
          });
        },
      ],
      [
        hotKeyRefs.REQUEST_SHOW_CREATE_FOLDER,
        () => {
          const { activeRequest, activeWorkspace } = this.props;
          if (!activeWorkspace) {
            return;
          }

          const parentId = activeRequest ? activeRequest.parentId : activeWorkspace._id;
          createRequestGroup(parentId);
        },
      ],
      [
        hotKeyRefs.REQUEST_SHOW_GENERATE_CODE_EDITOR,
        async () => {
          showModal(GenerateCodeModal, this.props.activeRequest);
        },
      ],
      [
        hotKeyRefs.REQUEST_SHOW_DUPLICATE,
        () => {
          this._requestDuplicate(this.props.activeRequest || undefined);
        },
      ],
      [
        hotKeyRefs.REQUEST_TOGGLE_PIN,
        async () => {
          const { activeRequest } = this.props;

          if (!activeRequest) {
            return;
          }

          const meta = isGrpcRequest(activeRequest) ? await getGrpcRequestMetaByParentId(activeRequest._id) : await getRequestMetaByParentId(activeRequest._id);
          updateRequestMetaByParentId(activeRequest._id, { pinned:!meta?.pinned });
        },
      ],
      [hotKeyRefs.PLUGIN_RELOAD, this._handleReloadPlugins],
      [hotKeyRefs.ENVIRONMENT_SHOW_VARIABLE_SOURCE_AND_VALUE, this._updateShowVariableSourceAndValue],
      [
        hotKeyRefs.SIDEBAR_TOGGLE,
        () => {
          if (this.props.activeWorkspaceMeta) {
            models.workspaceMeta.update(this.props.activeWorkspaceMeta, { sidebarHidden: !this.props.activeWorkspaceMeta.sidebarHidden });
          }
        },
      ],
    ];
  }

  _requestDuplicate(request?: Request | GrpcRequest) {
    if (!request) {
      return;
    }

    showPrompt({
      title: 'Duplicate Request',
      defaultValue: request.name,
      submitName: 'Create',
      label: 'New Name',
      selectText: true,
      onComplete: async (name: string) => {
        const newRequest = await requestOperations.duplicate(request, {
          name,
        });
        await this._handleSetActiveRequest(newRequest._id);
        models.stats.incrementCreatedRequests();
      },
    });
  }

  static async _updateRequestGroupMetaByParentId(requestGroupId: string, patch: Partial<RequestGroupMeta>) {
    const requestGroupMeta = await models.requestGroupMeta.getByParentId(requestGroupId);

    if (requestGroupMeta) {
      await models.requestGroupMeta.update(requestGroupMeta, patch);
    } else {
      const newPatch = Object.assign(
        {
          parentId: requestGroupId,
        },
        patch,
      );
      await models.requestGroupMeta.create(newPatch);
    }
  }

  async _updateShowVariableSourceAndValue() {
    const { settings } = this.props;
    await models.settings.update(settings, { showVariableSourceAndValue: !settings.showVariableSourceAndValue });
  }

  async _handleSetActiveRequest(activeRequestId: string) {
    if (this.props.activeWorkspaceMeta) {
      await models.workspaceMeta.update(this.props.activeWorkspaceMeta, { activeRequestId });
    }
    await updateRequestMetaByParentId(activeRequestId, {
      lastActive: Date.now(),
    });
  }

  async _handleSetResponseFilter(requestId: string, responseFilter: string) {
    await updateRequestMetaByParentId(requestId, {
      responseFilter,
    });

    if (this._responseFilterHistorySaveTimeout !== null) {
      clearTimeout(this._responseFilterHistorySaveTimeout);
    }
    this._responseFilterHistorySaveTimeout = setTimeout(async () => {
      const meta = await models.requestMeta.getByParentId(requestId);
      // @ts-expect-error -- TSCONVERSION meta can be null
      const responseFilterHistory = meta.responseFilterHistory.slice(0, 10);

      // Already in history?
      if (responseFilterHistory.includes(responseFilter)) {
        return;
      }

      // Blank?
      if (!responseFilter) {
        return;
      }

      responseFilterHistory.unshift(responseFilter);
      await updateRequestMetaByParentId(requestId, {
        responseFilterHistory,
      });
    }, 2000);
  }

  async _handleUpdateRequestMimeType(mimeType: string | null): Promise<Request | null> {
    if (!this.props.activeRequest) {
      console.warn('Tried to update request mime-type when no active request');
      return null;
    }

    const requestMeta = await models.requestMeta.getOrCreateByParentId(
      this.props.activeRequest._id,
    );
    const savedBody = requestMeta.savedRequestBody;
    const saveValue =
      typeof mimeType !== 'string' // Switched to No body
        ? this.props.activeRequest.body
        : {};
    // Clear saved value in requestMeta
    await models.requestMeta.update(requestMeta, {
      savedRequestBody: saveValue,
    });
    // @ts-expect-error -- TSCONVERSION should skip this if active request is grpc request
    const newRequest = await updateMimeType(this.props.activeRequest, mimeType, false, savedBody);
    // Force it to update, because other editor components (header editor)
    // needs to change. Need to wait a delay so the next render can finish
    setTimeout(() => {
      this.setState({
        forceRefreshHeaderCounter: this.state.forceRefreshHeaderCounter + 1,
      });
    }, 500);
    return newRequest;
  }

  _handleKeyDown(event: KeyboardEvent) {
    for (const [definition, callback] of this._globalKeyMap) {
      executeHotKey(event, definition, callback);
    }
  }

  static _handleShowSettingsModal(tabIndex?: number) {
    showModal(SettingsModal, tabIndex);
  }

  _setWrapperRef(wrapper: WrapperClass) {
    this._wrapper = wrapper;
  }

  async _handleReloadPlugins() {
    const { settings } = this.props;
    await plugins.reloadPlugins();
    await themes.applyColorScheme(settings);
    templating.reload();
    console.log('[plugins] reloaded');
  }

  /**
   * Update document.title to be "Project - Workspace (Environment) – Request" when not home
   * @private
   */
  _updateDocumentTitle() {
    const {
      activeWorkspace,
      activeProject,
      activeWorkspaceName,
      activeEnvironment,
      activeRequest,
      activeActivity,
    } = this.props;
    let title;

    if (activeActivity === ACTIVITY_HOME) {
      title = getProductName();
    } else if (activeWorkspace && activeWorkspaceName) {
      title = activeProject.name;
      title += ` - ${activeWorkspaceName}`;

      if (activeEnvironment) {
        title += ` (${activeEnvironment.name})`;
      }

      if (activeRequest) {
        title += ` – ${activeRequest.name}`;
      }
    }

    document.title = title || getProductName();
  }

  componentDidUpdate(prevProps: AppProps) {
    this._updateDocumentTitle();

    this._ensureWorkspaceChildren();

    // Force app refresh if login state changes
    if (prevProps.isLoggedIn !== this.props.isLoggedIn) {
      this.setState(state => ({
        forceRefreshCounter: state.forceRefreshCounter + 1,
      }));
    }

    // Check on VCS things
    const { activeWorkspace, activeProject, activeGitRepository } = this.props;
    const changingWorkspace = prevProps.activeWorkspace?._id !== activeWorkspace?._id;

    // Update VCS if needed
    if (changingWorkspace) {
      this._updateVCS();
    }

    // Update Git VCS if needed
    const changingProject = prevProps.activeProject?._id !== activeProject?._id;
    const changingGit = prevProps.activeGitRepository?._id !== activeGitRepository?._id;

    if (changingWorkspace || changingProject || changingGit) {
      this._updateGitVCS();
    }
  }

  async _updateGitVCS() {
    const { activeGitRepository, activeWorkspace, activeProject } = this.props;

    // Get the vcs and set it to null in the state while we update it
    let gitVCS = this.state.gitVCS;
    this.setState({
      gitVCS: null,
    });

    if (!gitVCS) {
      gitVCS = new GitVCS();
    }

    if (activeWorkspace && activeGitRepository) {
      // Create FS client
      const baseDir = path.join(
        getDataDirectory(),
        `version-control/git/${activeGitRepository._id}`,
      );

      /** All app data is stored within a namespaced GIT_INSOMNIA_DIR directory at the root of the repository and is read/written from the local NeDB database */
      const neDbClient = NeDBClient.createClient(activeWorkspace._id, activeProject._id);

      /** All git metadata in the GIT_INTERNAL_DIR directory is stored in a git/ directory on the filesystem */
      const gitDataClient = fsClient(baseDir);

      /** All data outside the directories listed below will be stored in an 'other' directory. This is so we can support files that exist outside the ones the app is specifically in charge of. */
      const otherDatClient = fsClient(path.join(baseDir, 'other'));

      /** The routable FS client directs isomorphic-git to read/write from the database or from the correct directory on the file system while performing git operations. */
      const routableFS = routableFSClient(otherDatClient, {
        [GIT_INSOMNIA_DIR]: neDbClient,
        [GIT_INTERNAL_DIR]: gitDataClient,
      });
      // Init VCS
      const { credentials, uri } = activeGitRepository;

      if (activeGitRepository.needsFullClone) {
        await models.gitRepository.update(activeGitRepository, {
          needsFullClone: false,
        });
        await gitVCS.initFromClone({
          url: uri,
          gitCredentials: credentials,
          directory: GIT_CLONE_DIR,
          fs: routableFS,
          gitDirectory: GIT_INTERNAL_DIR,
        });
      } else {
        await gitVCS.init({
          directory: GIT_CLONE_DIR,
          fs: routableFS,
          gitDirectory: GIT_INTERNAL_DIR,
        });
      }

      // Configure basic info
      const { author, uri: gitUri } = activeGitRepository;
      await gitVCS.setAuthor(author.name, author.email);
      await gitVCS.addRemote(gitUri);
    } else {
      // Create new one to un-initialize it
      gitVCS = new GitVCS();
    }

    this.setState({
      gitVCS,
    });
  }

  async _updateVCS() {
    const { activeWorkspace } = this.props;

    const lock = generateId();
    this._updateVCSLock = lock;

    // Get the vcs and set it to null in the state while we update it
    let vcs = this.state.vcs;
    this.setState({
      vcs: null,
    });

    if (!vcs) {
      const driver = FileSystemDriver.create(getDataDirectory());

      vcs = new VCS(driver, async conflicts => {
        return new Promise(resolve => {
          showModal(SyncMergeModal, {
            conflicts,
            handleDone: (conflicts: MergeConflict[]) => resolve(conflicts),
          });
        });
      });
    }

    if (activeWorkspace) {
      await vcs.switchProject(activeWorkspace._id);
    } else {
      vcs.clearBackendProject();
    }

    // Prevent a potential race-condition when _updateVCS() gets called for different workspaces in rapid succession
    if (this._updateVCSLock === lock) {
      this.setState({
        vcs,
      });
    }
  }

  async _handleDbChange(changes: ChangeBufferEvent[]) {
    let needsRefresh = false;

    for (const change of changes) {
      const [type, doc, fromSync] = change;
      const { vcs } = this.state;
      const { activeRequest } = this.props;

      // Force refresh if environment changes
      // TODO: Only do this for environments in this workspace (not easy because they're nested)
      if (isEnvironment(doc)) {
        console.log('[App] Forcing update from environment change', change);
        needsRefresh = true;
      }

      // Force refresh if sync changes the active request
      if (fromSync && activeRequest && doc._id === activeRequest._id) {
        needsRefresh = true;
        console.log('[App] Forcing update from request change', change);
      }

      // Delete VCS project if workspace deleted
      if (vcs && isWorkspace(doc) && type === db.CHANGE_REMOVE) {
        await vcs.removeBackendProjectsForRoot(doc._id);
      }
    }

    if (needsRefresh) {
      setTimeout(() => {
        this._wrapper?._forceRequestPaneRefresh();
      }, 300);
    }
  }

  async componentDidMount() {
    // Bind key handlers
    this._setGlobalKeyMap();

    // Update title
    this._updateDocumentTitle();

    // Update VCS
    await this._updateVCS();
    await this._updateGitVCS();
    db.onChange(this._handleDbChange);
    ipcRenderer.on('toggle-preferences', () => {
      App._handleShowSettingsModal();
    });

    if (isDevelopment()) {
      ipcRenderer.on('clear-model', () => {
        const options = models
          .types()
          .filter(t => t !== models.settings.type) // don't clear settings
          .map(t => ({ name: t, value: t }));

        showSelectModal({
          title: 'Clear a model',
          message: 'Select a model to clear; this operation cannot be undone.',
          value: options[0].value,
          options,
          onDone: async type => {
            if (type) {
              const bufferId = await db.bufferChanges();
              console.log(`[developer] clearing all "${type}" entities`);
              const allEntities = await db.all(type);
              const filteredEntites = allEntities
                .filter(isNotDefaultProject); // don't clear the default project
              await db.batchModifyDocs({ remove: filteredEntites });
              db.flushChanges(bufferId);
            }
          },
        });
      });

      ipcRenderer.on('clear-all-models', () => {
        showModal(AskModal, {
          title: 'Clear all models',
          message: 'Are you sure you want to clear all models? This operation cannot be undone.',
          yesText: 'Yes',
          noText: 'No',
          onDone: async (yes: boolean) => {
            if (yes) {
              const bufferId = await db.bufferChanges();
              const promises = models
                .types()
                .filter(t => t !== models.settings.type) // don't clear settings
                .reverse().map(async type => {
                  console.log(`[developer] clearing all "${type}" entities`);
                  const allEntities = await db.all(type);
                  const filteredEntites = allEntities
                    .filter(isNotDefaultProject); // don't clear the default project
                  await db.batchModifyDocs({ remove: filteredEntites });
                });
              await Promise.all(promises);
              db.flushChanges(bufferId);
            }
          },
        });
      });
    }

    ipcRenderer.on('reload-plugins', this._handleReloadPlugins);
    ipcRenderer.on('toggle-preferences-shortcuts', () => {
      App._handleShowSettingsModal(TAB_INDEX_SHORTCUTS);
    });
    ipcRenderer.on('run-command', (_, commandUri) => {
      const parsed = urlParse(commandUri, true);
      const command = `${parsed.hostname}${parsed.pathname}`;
      const args = JSON.parse(JSON.stringify(parsed.query));
      args.workspaceId = args.workspaceId || this.props.activeWorkspace?._id;
      this.props.handleCommand(command, args);
    });
    // NOTE: This is required for "drop" event to trigger.
    document.addEventListener(
      'dragover',
      event => {
        event.preventDefault();
      },
      false,
    );
    document.addEventListener(
      'drop',
      async event => {
        event.preventDefault();
        const { activeWorkspace, handleImportUri } = this.props;

        if (!activeWorkspace) {
          return;
        }

        // @ts-expect-error -- TSCONVERSION
        if (event.dataTransfer.files.length === 0) {
          console.log('[drag] Ignored drop event because no files present');
          return;
        }

        // @ts-expect-error -- TSCONVERSION
        const file = event.dataTransfer.files[0];
        const { path } = file;
        const uri = `file://${path}`;
        await showAlert({
          title: 'Confirm Data Import',
          message: (
            <span>
              Import <code>{path}</code>?
            </span>
          ),
          addCancel: true,
        });
        handleImportUri(uri, { workspaceId: activeWorkspace?._id });
      },
      false,
    );

    // Give it a bit before letting the backend know it's ready
    setTimeout(() => ipcRenderer.send('window-ready'), 500);
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addListener(async () => themes.applyColorScheme(this.props.settings));
  }

  componentWillUnmount() {
    db.offChange(this._handleDbChange);
  }

  async _ensureWorkspaceChildren() {
    const {
      activeWorkspace,
      activeWorkspaceMeta,
      activeCookieJar,
      environments,
      activeApiSpec,
    } = this.props;

    if (!activeWorkspace) {
      return;
    }

    const baseEnvironments = environments.filter(environment => environment.parentId === activeWorkspace._id);

    // Nothing to do
    if (baseEnvironments.length && activeCookieJar && activeApiSpec && activeWorkspaceMeta) {
      return;
    }

    // We already started migrating. Let it finish.
    if (this.state.isMigratingChildren) {
      return;
    }

    // Prevent rendering of everything
    this.setState(
      {
        isMigratingChildren: true,
      },
      async () => {
        const flushId = await db.bufferChanges();
        await models.workspace.ensureChildren(activeWorkspace);
        await db.flushChanges(flushId);
        this.setState({
          isMigratingChildren: false,
        });
      },
    );
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillReceiveProps() {
    this._ensureWorkspaceChildren();
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillMount() {
    this._ensureWorkspaceChildren();
  }

  render() {
    if (this.state.isMigratingChildren) {
      console.log('[app] Waiting for migration to complete');
      return null;
    }

    if (!this.props.isFinishedBooting) {
      console.log('[app] Waiting to finish booting');
      return null;
    }

    const { activeWorkspace } = this.props;
    const {
      gitVCS,
      vcs,
      forceRefreshCounter,
      forceRefreshHeaderCounter,
    } = this.state;
    const uniquenessKey = `${forceRefreshCounter}::${activeWorkspace?._id || 'n/a'}`;
    return (
      <KeydownBinder onKeydown={this._handleKeyDown}>
        <GrpcProvider>
          <NunjucksEnabledProvider>
            <AppHooks />

            <div className="app" key={uniquenessKey}>
              <ErrorBoundary showAlert>
                <Wrapper
                  ref={this._setWrapperRef}
                  handleDuplicateRequest={this._requestDuplicate}
                  handleSetResponseFilter={this._handleSetResponseFilter}
                  handleUpdateRequestMimeType={this._handleUpdateRequestMimeType}
                  headerEditorKey={forceRefreshHeaderCounter + ''}
                  vcs={vcs}
                  gitVCS={gitVCS}
                />
              </ErrorBoundary>

              <ErrorBoundary showAlert>
                <Toast />
              </ErrorBoundary>
            </div>
          </NunjucksEnabledProvider>
        </GrpcProvider>
      </KeydownBinder>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  activeActivity: selectActiveActivity(state),
  activeProject: selectActiveProject(state),
  activeApiSpec: selectActiveApiSpec(state),
  activeWorkspaceName: selectActiveWorkspaceName(state),
  activeCookieJar: selectActiveCookieJar(state),
  activeEnvironment: selectActiveEnvironment(state),
  activeGitRepository: selectActiveGitRepository(state),
  activeRequest: selectActiveRequest(state),
  activeWorkspace: selectActiveWorkspace(state),
  activeWorkspaceMeta: selectActiveWorkspaceMeta(state),
  environments: selectEnvironments(state),
  isLoggedIn: selectIsLoggedIn(state),
  isFinishedBooting: selectIsFinishedBooting(state),
  settings: selectSettings(state),
});

const mapDispatchToProps = (dispatch: Dispatch<Action<any>>) => {
  const {
    importUri: handleImportUri,
    newCommand: handleCommand,
  } = bindActionCreators({
    importUri,
    newCommand,
  }, dispatch);
  return {
    handleCommand,
    handleImportUri,
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(withDragDropContext(App));
