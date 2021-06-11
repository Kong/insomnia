import React, { PureComponent, RefObject } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import {
  AUTOBIND_CFG,
  ACTIVITY_HOME,
  COLLAPSE_SIDEBAR_REMS,
  DEFAULT_PANE_HEIGHT,
  DEFAULT_PANE_WIDTH,
  DEFAULT_SIDEBAR_WIDTH,
  getAppName,
  MAX_PANE_HEIGHT,
  MAX_PANE_WIDTH,
  MAX_SIDEBAR_REMS,
  MIN_PANE_HEIGHT,
  MIN_PANE_WIDTH,
  MIN_SIDEBAR_REMS,
  PREVIEW_MODE_SOURCE,
  ACTIVITY_MIGRATION,
  SortOrder,
  GlobalActivity,
} from '../../common/constants';
import fs from 'fs';
import { clipboard, ipcRenderer, remote, SaveDialogOptions } from 'electron';
import { parse as urlParse } from 'url';
import HTTPSnippet from 'httpsnippet';
import ReactDOM from 'react-dom';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import Wrapper from '../components/wrapper';
import WorkspaceEnvironmentsEditModal from '../components/modals/workspace-environments-edit-modal';
import Toast from '../components/toast';
import CookiesModal from '../components/modals/cookies-modal';
import RequestSwitcherModal from '../components/modals/request-switcher-modal';
import SettingsModal, { TAB_INDEX_SHORTCUTS } from '../components/modals/settings-modal';
import * as globalActions from '../redux/modules/global';
import * as entitiesActions from '../redux/modules/entities';
import { database as db } from '../../common/database';
import * as models from '../../models';
import {
  selectActiveCookieJar,
  selectActiveGitRepository,
  selectActiveOAuth2Token,
  selectActiveRequest,
  selectActiveRequestMeta,
  selectActiveRequestResponses,
  selectActiveResponse,
  selectActiveSpace,
  selectActiveUnitTestResult,
  selectActiveUnitTests,
  selectActiveUnitTestSuite,
  selectActiveUnitTestSuites,
  selectActiveWorkspace,
  selectActiveWorkspaceClientCertificates,
  selectActiveWorkspaceMeta,
  selectEntitiesLists,
  selectSyncItems,
  selectUnseenWorkspaces,
  selectWorkspaceRequestsAndRequestGroups,
  selectWorkspacesForActiveSpace,
} from '../redux/selectors';
import { selectSidebarChildren } from '../redux/sidebar-selectors';
import RequestCreateModal from '../components/modals/request-create-modal';
import GenerateCodeModal from '../components/modals/generate-code-modal';
import WorkspaceSettingsModal from '../components/modals/workspace-settings-modal';
import RequestSettingsModal from '../components/modals/request-settings-modal';
import RequestRenderErrorModal from '../components/modals/request-render-error-modal';
import * as network from '../../network/network';
import {
  debounce,
  generateId,
  getContentDispositionHeader,
} from '../../common/misc';
import { getDataDirectory } from '../../common/electron-helpers';
import * as mime from 'mime-types';
import * as path from 'path';
import * as render from '../../common/render';
import { getKeys } from '../../templating/utils';
import { showAlert, showModal, showPrompt } from '../components/modals/index';
import { exportHarRequest } from '../../common/har';
import { hotKeyRefs } from '../../common/hotkeys';
import { executeHotKey } from '../../common/hotkeys-listener';
import KeydownBinder from '../components/keydown-binder';
import ErrorBoundary from '../components/error-boundary';
import * as plugins from '../../plugins';
import * as templating from '../../templating/index';
import { NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME } from '../../templating/index';
import AskModal from '../components/modals/ask-modal';
import { Request, updateMimeType } from '../../models/request';
import MoveRequestGroupModal from '../components/modals/move-request-group-modal';
import * as themes from '../../plugins/misc';
import ExportRequestsModal from '../components/modals/export-requests-modal';
import FileSystemDriver from '../../sync/store/drivers/file-system-driver';
import VCS from '../../sync/vcs';
import SyncMergeModal from '../components/modals/sync-merge-modal';
import { GitVCS, GIT_CLONE_DIR, GIT_INSOMNIA_DIR, GIT_INTERNAL_DIR } from '../../sync/git/git-vcs';
import { NeDBClient } from '../../sync/git/ne-db-client';
import { fsClient } from '../../sync/git/fs-client';
import { routableFSClient } from '../../sync/git/routable-fs-client';
import { getWorkspaceLabel } from '../../common/get-workspace-label';
import {
  isCollection,
  isGrpcRequest,
  isGrpcRequestId,
  isRequestGroup,
} from '../../models/helpers/is-model';
import * as requestOperations from '../../models/helpers/request-operations';
import { GrpcProvider } from '../context/grpc';
import { sortMethodMap } from '../../common/sorting';
import withDragDropContext from '../context/app/drag-drop-context';
import { trackSegmentEvent } from '../../common/analytics';
import getWorkspaceName from '../../models/helpers/get-workspace-name';
import * as workspaceOperations from '../../models/helpers/workspace-operations';
import { Settings } from '../../models/settings';
import { Workspace } from '../../models/workspace';
import { GrpcRequest } from '../../models/grpc-request';
import { Environment } from '../../models/environment';
import { GrpcRequestMeta } from '../../models/grpc-request-meta';
import { RequestMeta } from '../../models/request-meta';
import { RequestGroup } from '../../models/request-group';
import { ApiSpec } from '../../models/api-spec';
import { WorkspaceMeta } from '../../models/workspace-meta';
import { GitRepository } from '../../models/git-repository';
import { CookieJar } from '../../models/cookie-jar';
import { Response } from '../../models/response';
import { RenderContextAndKeys } from '../../common/render';

interface Props {
  sidebarWidth: number,
  paneWidth: number,
  paneHeight: number,
  handleCommand: Function,
  settings: Settings,
  isLoggedIn: boolean,
  activeWorkspace: Workspace,
  handleSetActiveActivity: Function,
  handleGoToNextActivity: Function,
  handleSetActiveWorkspace: Function,
  activeRequest?: Request | GrpcRequest,
  activeApiSpec: ApiSpec,
  activity: GlobalActivity,
  activeEnvironment?: Environment,
  isVariableUncovered: boolean,
  sidebarHidden: boolean,
  workspaces: Workspace[],
  apiSpecs: ApiSpec[],
  activeWorkspaceMeta: WorkspaceMeta,
  activeGitRepository: GitRepository,
  activeCookieJar: CookieJar,
  environments: Environment[],
  handleStartLoading: Function,
  handleStopLoading: Function
  handleImportUriToWorkspace: Function,
}

interface State {
  showDragOverlay: boolean,
  draggingSidebar: boolean,
  draggingPaneHorizontal: boolean,
  draggingPaneVertical: boolean,
  sidebarWidth: number,
  paneWidth: number,
  paneHeight: number,
  isVariableUncovered: boolean,
  vcs: VCS | null,
  gitVCS: GitVCS | null,
  forceRefreshCounter: number,
  forceRefreshHeaderCounter: number,
  isMigratingChildren: boolean,
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class App extends PureComponent<Props, State> {
  private _getRenderContextPromiseCache: Object;
  private _savePaneWidth: (paneWidth: number) => void;
  private _savePaneHeight: (paneWidth: number) => void;
  private _saveSidebarWidth: (paneWidth: number) => void;
  private _globalKeyMap: any;
  private _updateVCSLock: any;
  private _requestPane: RefObject<any>;
  private _responsePane: RefObject<any>;
  private _sidebar: RefObject<any>;
  private _wrapper: Wrapper | null = null;
  private _responseFilterHistorySaveTimeout: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      showDragOverlay: false,
      draggingSidebar: false,
      draggingPaneHorizontal: false,
      draggingPaneVertical: false,
      sidebarWidth: props.sidebarWidth || DEFAULT_SIDEBAR_WIDTH,
      paneWidth: props.paneWidth || DEFAULT_PANE_WIDTH,
      paneHeight: props.paneHeight || DEFAULT_PANE_HEIGHT,
      isVariableUncovered: props.isVariableUncovered || false,
      vcs: null,
      gitVCS: null,
      forceRefreshCounter: 0,
      forceRefreshHeaderCounter: 0,
      isMigratingChildren: false,
    };

    this._getRenderContextPromiseCache = {};
    this._savePaneWidth = debounce(paneWidth =>
      this._updateActiveWorkspaceMeta({
        paneWidth,
      }),
    );
    this._savePaneHeight = debounce(paneHeight =>
      this._updateActiveWorkspaceMeta({
        paneHeight,
      }),
    );
    this._saveSidebarWidth = debounce(sidebarWidth =>
      this._updateActiveWorkspaceMeta({
        sidebarWidth,
      }),
    );
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
      [hotKeyRefs.REQUEST_SEND, this._handleSendShortcut],
      [
        hotKeyRefs.ENVIRONMENT_SHOW_EDITOR,
        () => {
          const { activeWorkspace } = this.props;
          showModal(WorkspaceEnvironmentsEditModal, activeWorkspace);
        },
      ],
      [
        hotKeyRefs.SHOW_COOKIES_EDITOR,
        () => {
          const { activeWorkspace } = this.props;
          showModal(CookiesModal, activeWorkspace);
        },
      ],
      [
        hotKeyRefs.REQUEST_QUICK_CREATE,
        async () => {
          const { activeRequest, activeWorkspace } = this.props;
          const parentId = activeRequest ? activeRequest.parentId : activeWorkspace._id;
          const request = await models.request.create({
            parentId,
            name: 'New Request',
          });
          await this._handleSetActiveRequest(request._id);
          models.stats.incrementCreatedRequests();
          trackSegmentEvent('Request Created');
        },
      ],
      [
        hotKeyRefs.REQUEST_SHOW_CREATE,
        () => {
          const { activeRequest, activeWorkspace } = this.props;
          const parentId = activeRequest ? activeRequest.parentId : activeWorkspace._id;

          this._requestCreate(parentId);
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
            onDone: async confirmed => {
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
          const parentId = activeRequest ? activeRequest.parentId : activeWorkspace._id;

          this._requestGroupCreate(parentId);
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
        async () => {
          await this._requestDuplicate(this.props.activeRequest);
        },
      ],
      [
        hotKeyRefs.REQUEST_TOGGLE_PIN,
        async () => {
          // @ts-expect-error -- TSCONVERSION apparently entities doesn't exist on props
          const { activeRequest, entities } = this.props;

          if (!activeRequest) {
            return;
          }

          const entitiesToCheck = isGrpcRequest(activeRequest)
            ? entities.grpcRequestMetas
            : entities.requestMetas;
          const meta = Object.values<GrpcRequestMeta | RequestMeta>(entitiesToCheck).find(m => m.parentId === activeRequest._id);
          await this._handleSetRequestPinned(this.props.activeRequest, !meta?.pinned);
        },
      ],
      [hotKeyRefs.PLUGIN_RELOAD, this._handleReloadPlugins],
      [
        hotKeyRefs.ENVIRONMENT_UNCOVER_VARIABLES,
        async () => {
          await this._updateIsVariableUncovered();
        },
      ],
      [
        hotKeyRefs.SIDEBAR_TOGGLE,
        () => {
          this._handleToggleSidebar();
        },
      ],
    ];
  }

  async _handleSendShortcut() {
    const { activeRequest, activeEnvironment } = this.props;
    await this._handleSendRequestWithEnvironment(
      activeRequest ? activeRequest._id : 'n/a',
      activeEnvironment ? activeEnvironment._id : 'n/a',
    );
  }

  _setRequestPaneRef(n: RefObject<any>) {
    this._requestPane = n;
  }

  _setResponsePaneRef(n: RefObject<any>) {
    this._responsePane = n;
  }

  _setSidebarRef(n: RefObject<any>) {
    this._sidebar = n;
  }

  _requestGroupCreate(parentId: string) {
    showPrompt({
      title: 'New Folder',
      defaultValue: 'My Folder',
      submitName: 'Create',
      label: 'Name',
      selectText: true,
      onComplete: async name => {
        const requestGroup = await models.requestGroup.create({
          parentId,
          name,
        });
        await models.requestGroupMeta.create({
          parentId: requestGroup._id,
          collapsed: false,
        });
      },
    });
  }

  _requestCreate(parentId: string) {
    showModal(RequestCreateModal, {
      parentId,
      onComplete: (requestId: string) => {
        this._handleSetActiveRequest(requestId);

        models.stats.incrementCreatedRequests();
        trackSegmentEvent('Request Created');
      },
    });
  }

  async _recalculateMetaSortKey(docs: (RequestGroup | Request | GrpcRequest)[]) {
    function __updateDoc(doc, metaSortKey) {
      // @ts-expect-error -- TSCONVERSION the fetched model will only ever be a RequestGroup, Request, or GrpcRequest
      // Which all have the .update method. How do we better filter types?
      return models.getModel(doc.type)?.update(doc, {
        metaSortKey,
      });
    }

    return Promise.all(docs.map((doc, i) => __updateDoc(doc, i * 100)));
  }

  async _sortSidebar(order: SortOrder, parentId?: string) {
    let flushId: number | undefined;

    if (!parentId) {
      parentId = this.props.activeWorkspace._id;
      flushId = await db.bufferChanges();
    }

    const docs = [
      ...(await models.requestGroup.findByParentId(parentId)),
      ...(await models.request.findByParentId(parentId)),
      ...(await models.grpcRequest.findByParentId(parentId)),
    ].sort(sortMethodMap[order]);
    await this._recalculateMetaSortKey(docs);
    // sort RequestGroups recursively
    await Promise.all(docs.filter(isRequestGroup).map(g => this._sortSidebar(order, g._id)));

    if (flushId) {
      await db.flushChanges(flushId);
    }
  }

  static async _requestGroupDuplicate(requestGroup: RequestGroup) {
    showPrompt({
      title: 'Duplicate Folder',
      defaultValue: requestGroup.name,
      submitName: 'Create',
      label: 'New Name',
      selectText: true,
      onComplete: async (name: string) => {
        const newRequestGroup = await models.requestGroup.duplicate(requestGroup, {
          name,
        });
        models.stats.incrementCreatedRequestsForDescendents(newRequestGroup);
      },
    });
  }

  static async _requestGroupMove(requestGroup: RequestGroup) {
    showModal(MoveRequestGroupModal, {
      requestGroup,
    });
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

  _workspaceDuplicateById(callback: () => void, workspaceId: string) {
    const workspace = this.props.workspaces.find(w => w._id === workspaceId);
    const apiSpec = this.props.apiSpecs.find(s => s.parentId === workspaceId);
    showPrompt({
      // @ts-expect-error -- TSCONVERSION workspace can be null
      title: `Duplicate ${getWorkspaceLabel(workspace).singular}`,
      // @ts-expect-error -- TSCONVERSION workspace can be null
      defaultValue: getWorkspaceName(workspace, apiSpec),
      submitName: 'Create',
      selectText: true,
      label: 'New Name',
      onComplete: async name => {
        // @ts-expect-error -- TSCONVERSION workspace can be null
        const newWorkspace = await workspaceOperations.duplicate(workspace, name);
        await this.props.handleSetActiveWorkspace(newWorkspace._id);
        callback();
      },
    });
  }

  _workspaceDuplicate(callback: () => void) {
    this._workspaceDuplicateById(callback, this.props.activeWorkspace._id);
  }

  async _fetchRenderContext() {
    const { activeEnvironment, activeRequest, activeWorkspace } = this.props;
    const environmentId = activeEnvironment ? activeEnvironment._id : null;
    const ancestors = await db.withAncestors(activeRequest || activeWorkspace, [
      models.request.type,
      models.requestGroup.type,
      models.workspace.type,
    ]);
    // @ts-expect-error -- TSCONVERSION null vs undefined :(
    return render.getRenderContext(activeRequest, environmentId, ancestors);
  }

  async _handleGetRenderContext(): Promise<RenderContextAndKeys> {
    const context = await this._fetchRenderContext();
    const keys = getKeys(context, NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME);
    return {
      context,
      keys,
    };
  }

  /**
   * Heavily optimized render function
   *
   * @param text - template to render
   * @param contextCacheKey - if rendering multiple times in parallel, set this
   * @returns {Promise}
   * @private
   */
  async _handleRenderText<T>(obj: T, contextCacheKey = null) {
    // @ts-expect-error -- TSCONVERSION contextCacheKey being null used as object index
    if (!contextCacheKey || !this._getRenderContextPromiseCache[contextCacheKey]) {
      // NOTE: We're caching promises here to avoid race conditions
      // @ts-expect-error -- TSCONVERSION contextCacheKey being null used as object index
      this._getRenderContextPromiseCache[contextCacheKey] = this._fetchRenderContext();
    }

    // Set timeout to delete the key eventually
    // @ts-expect-error -- TSCONVERSION contextCacheKey being null used as object index
    setTimeout(() => delete this._getRenderContextPromiseCache[contextCacheKey], 5000);
    // @ts-expect-error -- TSCONVERSION contextCacheKey being null used as object index
    const context = await this._getRenderContextPromiseCache[contextCacheKey];
    return render.render(obj, context);
  }

  _handleGenerateCodeForActiveRequest() {
    // @ts-expect-error -- TSCONVERSION should skip this if active request is grpc request
    App._handleGenerateCode(this.props.activeRequest);
  }

  static _handleGenerateCode(request: Request) {
    showModal(GenerateCodeModal, request);
  }

  async _handleCopyAsCurl(request: Request) {
    const { activeEnvironment } = this.props;
    const environmentId = activeEnvironment ? activeEnvironment._id : 'n/a';
    const har = await exportHarRequest(request._id, environmentId);
    const snippet = new HTTPSnippet(har);
    const cmd = snippet.convert('shell', 'curl');
    clipboard.writeText(cmd);
  }

  static async _updateRequestGroupMetaByParentId(requestGroupId, patch) {
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

  async _updateActiveWorkspaceMeta(patch: Partial<WorkspaceMeta>) {
    const { activeWorkspaceMeta } = this.props;
    return models.workspaceMeta.update(activeWorkspaceMeta, patch);
  }

  static async _updateRequestMetaByParentId(requestId, patch) {
    const isGrpc = isGrpcRequestId(requestId);

    if (isGrpc) {
      return models.grpcRequestMeta.updateOrCreateByParentId(requestId, patch);
    } else {
      return models.requestMeta.updateOrCreateByParentId(requestId, patch);
    }
  }

  _updateIsVariableUncovered() {
    this.setState({
      isVariableUncovered: !this.state.isVariableUncovered,
    });
  }

  _handleSetPaneWidth(paneWidth: number) {
    this.setState({
      paneWidth,
    });

    this._savePaneWidth(paneWidth);
  }

  _handleSetPaneHeight(paneHeight: number) {
    this.setState({
      paneHeight,
    });

    this._savePaneHeight(paneHeight);
  }

  async _handleSetActiveRequest(activeRequestId: string) {
    await this._updateActiveWorkspaceMeta({
      activeRequestId,
    });
    await App._updateRequestMetaByParentId(activeRequestId, {
      lastActive: Date.now(),
    });
  }

  async _handleSetActiveEnvironment(activeEnvironmentId: string) {
    await this._updateActiveWorkspaceMeta({
      activeEnvironmentId,
    });
    // Give it time to update and re-render
    setTimeout(() => {
      this._wrapper && this._wrapper._forceRequestPaneRefresh();
    }, 300);
  }

  _handleSetSidebarWidth(sidebarWidth: number) {
    this.setState({
      sidebarWidth,
    });

    this._saveSidebarWidth(sidebarWidth);
  }

  async _handleSetSidebarHidden(sidebarHidden: boolean) {
    await this._updateActiveWorkspaceMeta({
      sidebarHidden,
    });
  }

  async _handleSetSidebarFilter(sidebarFilter: string) {
    await this._updateActiveWorkspaceMeta({
      sidebarFilter,
    });
  }

  _handleSetRequestGroupCollapsed(requestGroupId: string, collapsed: boolean) {
    App._updateRequestGroupMetaByParentId(requestGroupId, {
      collapsed,
    });
  }

  async _handleSetRequestPinned(request, pinned) {
    App._updateRequestMetaByParentId(request._id, {
      pinned,
    });
  }

  _handleSetResponsePreviewMode(requestId, previewMode) {
    App._updateRequestMetaByParentId(requestId, {
      previewMode,
    });
  }

  _handleUpdateDownloadPath(requestId, downloadPath) {
    App._updateRequestMetaByParentId(requestId, {
      downloadPath,
    });
  }

  async _handleSetResponseFilter(requestId, responseFilter) {
    await App._updateRequestMetaByParentId(requestId, {
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
      await App._updateRequestMetaByParentId(requestId, {
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

  async _getDownloadLocation() {
    const options: SaveDialogOptions = {
      title: 'Select Download Location',
      buttonLabel: 'Save',
    };
    const defaultPath = window.localStorage.getItem('insomnia.sendAndDownloadLocation');

    if (defaultPath) {
      // NOTE: An error will be thrown if defaultPath is supplied but not a String
      options.defaultPath = defaultPath;
    }

    const { filePath } = await remote.dialog.showSaveDialog(options);
    // @ts-expect-error -- TSCONVERSION don't set item if filePath is undefined
    window.localStorage.setItem('insomnia.sendAndDownloadLocation', filePath);
    return filePath || null;
  }

  async _handleSendAndDownloadRequestWithEnvironment(requestId: string, environmentId: string, dir: string) {
    const { settings, handleStartLoading, handleStopLoading } = this.props;
    const request = await models.request.getById(requestId);

    if (!request) {
      return;
    }

    // Update request stats
    models.stats.incrementExecutedRequests();
    trackSegmentEvent('Request Executed');
    // Start loading
    handleStartLoading(requestId);

    try {
      const responsePatch = await network.send(requestId, environmentId);
      const headers = responsePatch.headers || [];
      const header = getContentDispositionHeader(headers);
      const nameFromHeader = header ? header.value : null;

      if (
        responsePatch.bodyPath &&
        responsePatch.statusCode &&
        responsePatch.statusCode >= 200 &&
        responsePatch.statusCode < 300
      ) {
        // @ts-expect-error -- TSCONVERSION contentType can be undefined
        const extension = mime.extension(responsePatch.contentType) || 'unknown';
        const name =
          nameFromHeader || `${request.name.replace(/\s/g, '-').toLowerCase()}.${extension}`;
        let filename;

        if (dir) {
          filename = path.join(dir, name);
        } else {
          filename = await this._getDownloadLocation();
        }

        if (!filename) {
          return;
        }

        const to = fs.createWriteStream(filename);
        // @ts-expect-error -- TSCONVERSION
        const readStream = models.response.getBodyStream(responsePatch);

        if (!readStream) {
          return;
        }

        readStream.pipe(to);

        readStream.on('end', async () => {
          responsePatch.error = `Saved to ${filename}`;
          await models.response.create(responsePatch, settings.maxHistoryResponses);
        });

        readStream.on('error', async err => {
          console.warn('Failed to download request after sending', responsePatch.bodyPath, err);
          await models.response.create(responsePatch, settings.maxHistoryResponses);
        });
      } else {
        // Save the bad responses so failures are shown still
        await models.response.create(responsePatch, settings.maxHistoryResponses);
      }
    } catch (err) {
      showAlert({
        title: 'Unexpected Request Failure',
        message: (
          <div>
            <p>The request failed due to an unhandled error:</p>
            <code className="wide selectable">
              <pre>{err.message}</pre>
            </code>
          </div>
        ),
      });
    } finally {
      // Unset active response because we just made a new one
      await App._updateRequestMetaByParentId(requestId, {
        activeResponseId: null,
      });
      // Stop loading
      handleStopLoading(requestId);
    }
  }

  async _handleSendRequestWithEnvironment(requestId, environmentId) {
    const { handleStartLoading, handleStopLoading, settings } = this.props;
    const request = await models.request.getById(requestId);

    if (!request) {
      return;
    }

    // Update request stats
    models.stats.incrementExecutedRequests();
    trackSegmentEvent('Request Executed');
    handleStartLoading(requestId);

    try {
      const responsePatch = await network.send(requestId, environmentId);
      await models.response.create(responsePatch, settings.maxHistoryResponses);
    } catch (err) {
      if (err.type === 'render') {
        showModal(RequestRenderErrorModal, {
          request,
          error: err,
        });
      } else {
        showAlert({
          title: 'Unexpected Request Failure',
          message: (
            <div>
              <p>The request failed due to an unhandled error:</p>
              <code className="wide selectable">
                <pre>{err.message}</pre>
              </code>
            </div>
          ),
        });
      }
    }

    // Unset active response because we just made a new one
    await App._updateRequestMetaByParentId(requestId, {
      activeResponseId: null,
    });
    // Stop loading
    handleStopLoading(requestId);
  }

  async _handleSetActiveResponse(requestId: string, activeResponse: Response | null = null) {
    const { activeEnvironment } = this.props;
    const activeResponseId = activeResponse ? activeResponse._id : null;
    await App._updateRequestMetaByParentId(requestId, {
      activeResponseId,
    });

    let response: Response;

    if (activeResponseId) {
      // @ts-expect-error -- TSCONVERSION can return null if not found
      response = await models.response.getById(activeResponseId);
    } else {
      const environmentId = activeEnvironment ? activeEnvironment._id : null;
      // @ts-expect-error -- TSCONVERSION can return null if not found
      response = await models.response.getLatestForRequest(requestId, environmentId);
    }

    const requestVersionId = response ? response.requestVersionId : 'n/a';
    // @ts-expect-error -- TSCONVERSION the above line should be response?.requestVersionId ?? 'n/a'
    const request = await models.requestVersion.restore(requestVersionId);

    if (request) {
      // Refresh app to reflect changes. Using timeout because we need to
      // wait for the request update to propagate.
      setTimeout(() => this._wrapper?._forceRequestPaneRefresh(), 500);
    } else {
      // Couldn't restore request. That's okay
    }
  }

  _requestCreateForWorkspace() {
    this._requestCreate(this.props.activeWorkspace._id);
  }

  _startDragSidebar() {
    this.setState({
      draggingSidebar: true,
    });
  }

  _resetDragSidebar() {
    // TODO: Remove setTimeout need be not triggering drag on double click
    setTimeout(() => this._handleSetSidebarWidth(DEFAULT_SIDEBAR_WIDTH), 50);
  }

  _startDragPaneHorizontal() {
    this.setState({
      draggingPaneHorizontal: true,
    });
  }

  _startDragPaneVertical() {
    this.setState({
      draggingPaneVertical: true,
    });
  }

  _resetDragPaneHorizontal() {
    // TODO: Remove setTimeout need be not triggering drag on double click
    setTimeout(() => this._handleSetPaneWidth(DEFAULT_PANE_WIDTH), 50);
  }

  _resetDragPaneVertical() {
    // TODO: Remove setTimeout need be not triggering drag on double click
    setTimeout(() => this._handleSetPaneHeight(DEFAULT_PANE_HEIGHT), 50);
  }

  _handleMouseMove(e) {
    if (this.state.draggingPaneHorizontal) {
      // Only pop the overlay after we've moved it a bit (so we don't block doubleclick);
      const distance = this.props.paneWidth - this.state.paneWidth;

      if (
        !this.state.showDragOverlay &&
        Math.abs(distance) > 0.02
        /* % */
      ) {
        this.setState({
          showDragOverlay: true,
        });
      }

      // @ts-expect-error -- TSCONVERSION
      const requestPane = ReactDOM.findDOMNode(this._requestPane);
      // @ts-expect-error -- TSCONVERSION
      const responsePane = ReactDOM.findDOMNode(this._responsePane);
      // @ts-expect-error -- TSCONVERSION
      const requestPaneWidth = requestPane.offsetWidth;
      // @ts-expect-error -- TSCONVERSION
      const responsePaneWidth = responsePane.offsetWidth;
      // @ts-expect-error -- TSCONVERSION
      const pixelOffset = e.clientX - requestPane.offsetLeft;
      let paneWidth = pixelOffset / (requestPaneWidth + responsePaneWidth);
      paneWidth = Math.min(Math.max(paneWidth, MIN_PANE_WIDTH), MAX_PANE_WIDTH);

      this._handleSetPaneWidth(paneWidth);
    } else if (this.state.draggingPaneVertical) {
      // Only pop the overlay after we've moved it a bit (so we don't block doubleclick);
      const distance = this.props.paneHeight - this.state.paneHeight;

      if (
        !this.state.showDragOverlay &&
        Math.abs(distance) > 0.02
        /* % */
      ) {
        this.setState({
          showDragOverlay: true,
        });
      }

      // @ts-expect-error -- TSCONVERSION
      const requestPane = ReactDOM.findDOMNode(this._requestPane);
      // @ts-expect-error -- TSCONVERSION
      const responsePane = ReactDOM.findDOMNode(this._responsePane);
      // @ts-expect-error -- TSCONVERSION
      const requestPaneHeight = requestPane.offsetHeight;
      // @ts-expect-error -- TSCONVERSION
      const responsePaneHeight = responsePane.offsetHeight;
      // @ts-expect-error -- TSCONVERSION
      const pixelOffset = e.clientY - requestPane.offsetTop;
      let paneHeight = pixelOffset / (requestPaneHeight + responsePaneHeight);
      paneHeight = Math.min(Math.max(paneHeight, MIN_PANE_HEIGHT), MAX_PANE_HEIGHT);

      this._handleSetPaneHeight(paneHeight);
    } else if (this.state.draggingSidebar) {
      // Only pop the overlay after we've moved it a bit (so we don't block doubleclick);
      const distance = this.props.sidebarWidth - this.state.sidebarWidth;

      if (
        !this.state.showDragOverlay &&
        Math.abs(distance) > 2
        /* ems */
      ) {
        this.setState({
          showDragOverlay: true,
        });
      }

      // @ts-expect-error -- TSCONVERSION
      const sidebar = ReactDOM.findDOMNode(this._sidebar);
      // @ts-expect-error -- TSCONVERSION
      const currentPixelWidth = sidebar.offsetWidth;
      // @ts-expect-error -- TSCONVERSION
      const ratio = (e.clientX - sidebar.offsetLeft) / currentPixelWidth;
      const width = this.state.sidebarWidth * ratio;
      let sidebarWidth = Math.min(width, MAX_SIDEBAR_REMS);

      if (sidebarWidth < COLLAPSE_SIDEBAR_REMS) {
        sidebarWidth = MIN_SIDEBAR_REMS;
      }

      this._handleSetSidebarWidth(sidebarWidth);
    }
  }

  _handleMouseUp() {
    if (this.state.draggingSidebar) {
      this.setState({
        draggingSidebar: false,
        showDragOverlay: false,
      });
    }

    if (this.state.draggingPaneHorizontal) {
      this.setState({
        draggingPaneHorizontal: false,
        showDragOverlay: false,
      });
    }

    if (this.state.draggingPaneVertical) {
      this.setState({
        draggingPaneVertical: false,
        showDragOverlay: false,
      });
    }
  }

  _handleKeyDown(e) {
    for (const [definition, callback] of this._globalKeyMap) {
      executeHotKey(e, definition, callback);
    }
  }

  _handleToggleMenuBar(hide) {
    for (const win of remote.BrowserWindow.getAllWindows()) {
      if (win.autoHideMenuBar !== hide) {
        win.setAutoHideMenuBar(hide);
        win.setMenuBarVisibility(!hide);
      }
    }
  }

  async _handleToggleSidebar() {
    const sidebarHidden = !this.props.sidebarHidden;
    await this._handleSetSidebarHidden(sidebarHidden);
  }

  _handleShowExportRequestsModal() {
    showModal(ExportRequestsModal);
  }

  static _handleShowSettingsModal(tabIndex?: number) {
    showModal(SettingsModal, tabIndex);
  }

  _setWrapperRef(n: Wrapper) {
    this._wrapper = n;
  }

  async _handleReloadPlugins() {
    const { settings } = this.props;
    await plugins.reloadPlugins();
    await themes.applyColorScheme(settings);
    templating.reload();
    console.log('[plugins] reloaded');
  }

  /**
   * Update document.title to be "Workspace (Environment) – Request" when not home
   * @private
   */
  _updateDocumentTitle() {
    const {
      activeWorkspace,
      activeApiSpec,
      activeEnvironment,
      activeRequest,
      activity,
    } = this.props;
    let title;

    if (activity === ACTIVITY_HOME || activity === ACTIVITY_MIGRATION) {
      title = getAppName();
    } else {
      title = isCollection(activeWorkspace) ? activeWorkspace.name : activeApiSpec.fileName;

      if (activeEnvironment) {
        title += ` (${activeEnvironment.name})`;
      }

      if (activeRequest) {
        title += ` – ${activeRequest.name}`;
      }
    }

    document.title = title;
  }

  componentDidUpdate(prevProps) {
    this._updateDocumentTitle();

    this._ensureWorkspaceChildren();

    // Force app refresh if login state changes
    if (prevProps.isLoggedIn !== this.props.isLoggedIn) {
      this.setState(state => ({
        forceRefreshCounter: state.forceRefreshCounter + 1,
      }));
    }

    // Check on VCS things
    const { activeWorkspace, activeGitRepository } = this.props;
    const changingWorkspace = prevProps.activeWorkspace._id !== activeWorkspace._id;

    // Update VCS if needed
    if (changingWorkspace) {
      this._updateVCS();
    }

    // Update Git VCS if needed
    const thisGit = activeGitRepository || {};
    const nextGit = prevProps.activeGitRepository || {};

    if (changingWorkspace || thisGit._id !== nextGit._id) {
      this._updateGitVCS();
    }
  }

  async _updateGitVCS() {
    const { activeGitRepository, activeWorkspace } = this.props;
    // Get the vcs and set it to null in the state while we update it
    let gitVCS = this.state.gitVCS;
    this.setState({
      gitVCS: null,
    });

    if (!gitVCS) {
      gitVCS = new GitVCS();
    }

    if (activeGitRepository) {
      // Create FS client
      const baseDir = path.join(
        getDataDirectory(),
        `version-control/git/${activeGitRepository._id}`,
      );

      /** All app data is stored within a namespaced GIT_INSOMNIA_DIR directory at the root of the repository and is read/written from the local NeDB database */
      const neDbClient = NeDBClient.createClient(activeWorkspace._id);

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
    const lock = generateId();
    this._updateVCSLock = lock;
    const { activeWorkspace } = this.props;
    // Get the vcs and set it to null in the state while we update it
    let vcs = this.state.vcs;
    this.setState({
      vcs: null,
    });

    if (!vcs) {
      const directory = path.join(getDataDirectory(), 'version-control');
      const driver = new FileSystemDriver({
        directory,
      });

      vcs = new VCS(driver, async conflicts => {
        return new Promise(resolve => {
          showModal(SyncMergeModal, {
            conflicts,
            handleDone: conflicts => resolve(conflicts),
          });
        });
      });
    }

    await vcs.switchProject(activeWorkspace._id);

    // Prevent a potential race-condition when _updateVCS() gets called for different workspaces in rapid succession
    if (this._updateVCSLock === lock) {
      this.setState({
        vcs,
      });
    }
  }

  async _handleDbChange(changes) {
    let needsRefresh = false;

    for (const change of changes) {
      const [type, doc, fromSync] = change;
      const { vcs } = this.state;
      const { activeRequest } = this.props;

      // Force refresh if environment changes
      // TODO: Only do this for environments in this workspace (not easy because they're nested)
      if (doc.type === models.environment.type) {
        console.log('[App] Forcing update from environment change', change);
        needsRefresh = true;
      }

      // Force refresh if sync changes the active request
      if (fromSync && activeRequest && doc._id === activeRequest._id) {
        needsRefresh = true;
        console.log('[App] Forcing update from request change', change);
      }

      // Delete VCS project if workspace deleted
      if (vcs && doc.type === models.workspace.type && type === db.CHANGE_REMOVE) {
        await vcs.removeProjectsForRoot(doc._id);
      }
    }

    if (needsRefresh) {
      setTimeout(() => {
        this._wrapper?._forceRequestPaneRefresh();
      }, 300);
    }
  }

  async componentDidMount() {
    // Bind mouse and key handlers
    document.addEventListener('mouseup', this._handleMouseUp);
    document.addEventListener('mousemove', this._handleMouseMove);

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
    ipcRenderer.on('reload-plugins', this._handleReloadPlugins);
    ipcRenderer.on('toggle-preferences-shortcuts', () => {
      App._handleShowSettingsModal(TAB_INDEX_SHORTCUTS);
    });
    ipcRenderer.on('run-command', (_, commandUri) => {
      const parsed = urlParse(commandUri, true);
      const command = `${parsed.hostname}${parsed.pathname}`;
      const args = JSON.parse(JSON.stringify(parsed.query));
      args.workspaceId = args.workspaceId || this.props.activeWorkspace._id;
      this.props.handleCommand(command, args);
    });
    // NOTE: This is required for "drop" event to trigger.
    document.addEventListener(
      'dragover',
      e => {
        e.preventDefault();
      },
      false,
    );
    document.addEventListener(
      'drop',
      async e => {
        e.preventDefault();
        const { activeWorkspace, handleImportUriToWorkspace } = this.props;

        if (!activeWorkspace) {
          return;
        }

        // @ts-expect-error -- TSCONVERSION
        if (e.dataTransfer.files.length === 0) {
          console.log('[drag] Ignored drop event because no files present');
          return;
        }

        // @ts-expect-error -- TSCONVERSION
        const file = e.dataTransfer.files[0];
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
        handleImportUriToWorkspace(activeWorkspace._id, uri);
      },
      false,
    );
    ipcRenderer.on('toggle-sidebar', this._handleToggleSidebar);

    // handle this
    this._handleToggleMenuBar(this.props.settings.autoHideMenuBar);

    // Give it a bit before letting the backend know it's ready
    setTimeout(() => ipcRenderer.send('window-ready'), 500);
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addListener(async () => themes.applyColorScheme(this.props.settings));
  }

  componentWillUnmount() {
    // Remove mouse and key handlers
    document.removeEventListener('mouseup', this._handleMouseUp);
    document.removeEventListener('mousemove', this._handleMouseMove);
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
    const baseEnvironments = environments.filter(e => e.parentId === activeWorkspace._id);

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
        await models.environment.getOrCreateForWorkspace(activeWorkspace);
        await models.cookieJar.getOrCreateForParentId(activeWorkspace._id);
        await models.workspaceMeta.getOrCreateByParentId(activeWorkspace._id);
        await db.flushChanges(flushId);
        this.setState({
          isMigratingChildren: false,
        });
      },
    );
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    // @ts-expect-error -- TSCONVERSION this function doesn't even accept props but should it?
    this._ensureWorkspaceChildren(nextProps);
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillMount() {
    // @ts-expect-error -- TSCONVERSION this function doesn't even accept props but should it?
    this._ensureWorkspaceChildren(this.props);
  }

  render() {
    if (this.state.isMigratingChildren) {
      console.log('[app] Waiting for migration to complete');
      return null;
    }

    const { activeWorkspace } = this.props;
    const {
      paneWidth,
      paneHeight,
      sidebarWidth,
      isVariableUncovered,
      gitVCS,
      vcs,
      forceRefreshCounter,
      forceRefreshHeaderCounter,
    } = this.state;
    const uniquenessKey = `${forceRefreshCounter}::${activeWorkspace._id}`;
    return (
      <KeydownBinder onKeydown={this._handleKeyDown}>
        <GrpcProvider>
          <div className="app" key={uniquenessKey}>
            <ErrorBoundary showAlert>
              {/* @ts-expect-error -- TSCONVERSION expected props are not recieved likely because of the this.props expansion */}
              <Wrapper
                {...this.props}
                ref={this._setWrapperRef}
                paneWidth={paneWidth}
                paneHeight={paneHeight}
                sidebarWidth={sidebarWidth}
                handleCreateRequestForWorkspace={this._requestCreateForWorkspace}
                handleSetRequestPinned={this._handleSetRequestPinned}
                handleSetRequestGroupCollapsed={this._handleSetRequestGroupCollapsed}
                handleActivateRequest={this._handleSetActiveRequest}
                handleSetRequestPaneRef={this._setRequestPaneRef}
                handleSetResponsePaneRef={this._setResponsePaneRef}
                handleSetSidebarRef={this._setSidebarRef}
                handleStartDragSidebar={this._startDragSidebar}
                handleResetDragSidebar={this._resetDragSidebar}
                handleStartDragPaneHorizontal={this._startDragPaneHorizontal}
                handleStartDragPaneVertical={this._startDragPaneVertical}
                handleResetDragPaneHorizontal={this._resetDragPaneHorizontal}
                handleResetDragPaneVertical={this._resetDragPaneVertical}
                handleCreateRequest={this._requestCreate}
                handleRender={this._handleRenderText}
                handleGetRenderContext={this._handleGetRenderContext}
                handleDuplicateRequest={this._requestDuplicate}
                handleDuplicateRequestGroup={App._requestGroupDuplicate}
                handleMoveRequestGroup={App._requestGroupMove}
                handleDuplicateWorkspace={this._workspaceDuplicate}
                handleCreateRequestGroup={this._requestGroupCreate}
                handleGenerateCode={App._handleGenerateCode}
                handleGenerateCodeForActiveRequest={this._handleGenerateCodeForActiveRequest}
                handleCopyAsCurl={this._handleCopyAsCurl}
                handleSetResponsePreviewMode={this._handleSetResponsePreviewMode}
                handleSetResponseFilter={this._handleSetResponseFilter}
                handleSendRequestWithEnvironment={this._handleSendRequestWithEnvironment}
                handleSendAndDownloadRequestWithEnvironment={
                  this._handleSendAndDownloadRequestWithEnvironment
                }
                handleSetActiveResponse={this._handleSetActiveResponse}
                handleSetActiveEnvironment={this._handleSetActiveEnvironment}
                handleSetSidebarFilter={this._handleSetSidebarFilter}
                handleToggleMenuBar={this._handleToggleMenuBar}
                handleUpdateRequestMimeType={this._handleUpdateRequestMimeType}
                handleShowExportRequestsModal={this._handleShowExportRequestsModal}
                handleShowSettingsModal={App._handleShowSettingsModal}
                handleUpdateDownloadPath={this._handleUpdateDownloadPath}
                isVariableUncovered={isVariableUncovered}
                headerEditorKey={forceRefreshHeaderCounter + ''}
                handleSidebarSort={this._sortSidebar}
                vcs={vcs}
                gitVCS={gitVCS}
              />
            </ErrorBoundary>

            <ErrorBoundary showAlert>
              <Toast />
            </ErrorBoundary>

            {/* Block all mouse activity by showing an overlay while dragging */}
            {this.state.showDragOverlay ? <div className="blocker-overlay" /> : null}
          </div>
        </GrpcProvider>
      </KeydownBinder>
    );
  }
}

function mapStateToProps(state, props) {
  const { entities, global } = state;
  const { activeActivity, isLoading, loadingRequestIds, isLoggedIn } = global;
  // Entities
  // @ts-expect-error -- TSCONVERSION https://github.com/reduxjs/reselect#accessing-react-props-in-selectors
  const entitiesLists = selectEntitiesLists(state, props);
  const {
    // @ts-expect-error -- TSCONVERSION
    apiSpecs,
    // @ts-expect-error -- TSCONVERSION
    environments,
    // @ts-expect-error -- TSCONVERSION
    gitRepositories,
    // @ts-expect-error -- TSCONVERSION
    requestGroups,
    // @ts-expect-error -- TSCONVERSION
    requestMetas,
    // @ts-expect-error -- TSCONVERSION
    requestVersions,
    // @ts-expect-error -- TSCONVERSION
    requests,
    // @ts-expect-error -- TSCONVERSION
    workspaceMetas,
  } = entitiesLists;
  // @ts-expect-error -- TSCONVERSION
  const settings = entitiesLists.settings[0];
  // Workspace stuff

  // @ts-expect-error -- TSCONVERSION https://github.com/reduxjs/reselect#accessing-react-props-in-selectors
  const activeSpace = selectActiveSpace(state, props);
  // @ts-expect-error -- TSCONVERSION https://github.com/reduxjs/reselect#accessing-react-props-in-selectors
  const workspaces = selectWorkspacesForActiveSpace(state, props);
  // @ts-expect-error -- TSCONVERSION https://github.com/reduxjs/reselect#accessing-react-props-in-selectors
  const activeWorkspaceMeta = selectActiveWorkspaceMeta(state, props);
  // @ts-expect-error -- TSCONVERSION https://github.com/reduxjs/reselect#accessing-react-props-in-selectors
  const activeWorkspace = selectActiveWorkspace(state, props);
  // @ts-expect-error -- TSCONVERSION https://github.com/reduxjs/reselect#accessing-react-props-in-selectors
  const activeWorkspaceClientCertificates = selectActiveWorkspaceClientCertificates(state, props);
  // @ts-expect-error -- TSCONVERSION https://github.com/reduxjs/reselect#accessing-react-props-in-selectors
  const activeGitRepository = selectActiveGitRepository(state, props);
  const safeMeta = activeWorkspaceMeta || {};
  const sidebarHidden = safeMeta.sidebarHidden || false;
  const sidebarFilter = safeMeta.sidebarFilter || '';
  const sidebarWidth = safeMeta.sidebarWidth || DEFAULT_SIDEBAR_WIDTH;
  const paneWidth = safeMeta.paneWidth || DEFAULT_PANE_WIDTH;
  const paneHeight = safeMeta.paneHeight || DEFAULT_PANE_HEIGHT;
  // Request stuff
  // @ts-expect-error -- TSCONVERSION https://github.com/reduxjs/reselect#accessing-react-props-in-selectors
  const requestMeta = selectActiveRequestMeta(state, props) || {};
  // @ts-expect-error -- TSCONVERSION https://github.com/reduxjs/reselect#accessing-react-props-in-selectors
  const activeRequest = selectActiveRequest(state, props);
  const responsePreviewMode = requestMeta.previewMode || PREVIEW_MODE_SOURCE;
  const responseFilter = requestMeta.responseFilter || '';
  const responseFilterHistory = requestMeta.responseFilterHistory || [];
  const responseDownloadPath = requestMeta.downloadPath || null;
  // Cookie Jar
  // @ts-expect-error -- TSCONVERSION https://github.com/reduxjs/reselect#accessing-react-props-in-selectors
  const activeCookieJar = selectActiveCookieJar(state, props);
  // Response stuff
  // @ts-expect-error -- TSCONVERSION https://github.com/reduxjs/reselect#accessing-react-props-in-selectors
  const activeRequestResponses = selectActiveRequestResponses(state, props) || [];
  // @ts-expect-error -- TSCONVERSION https://github.com/reduxjs/reselect#accessing-react-props-in-selectors
  const activeResponse = selectActiveResponse(state, props) || null;
  // Environment stuff
  const activeEnvironmentId = safeMeta.activeEnvironmentId;
  const activeEnvironment = entities.environments[activeEnvironmentId];
  // OAuth2Token stuff
  // @ts-expect-error -- TSCONVERSION https://github.com/reduxjs/reselect#accessing-react-props-in-selectors
  const oAuth2Token = selectActiveOAuth2Token(state, props);
  // Find other meta things
  const loadStartTime = loadingRequestIds[activeRequest ? activeRequest._id : 'n/a'] || -1;
  // @ts-expect-error -- TSCONVERSION https://github.com/reduxjs/reselect#accessing-react-props-in-selectors
  const sidebarChildren = selectSidebarChildren(state, props);
  // @ts-expect-error -- TSCONVERSION https://github.com/reduxjs/reselect#accessing-react-props-in-selectors
  const workspaceChildren = selectWorkspaceRequestsAndRequestGroups(state, props);
  // @ts-expect-error -- TSCONVERSION https://github.com/reduxjs/reselect#accessing-react-props-in-selectors
  const unseenWorkspaces = selectUnseenWorkspaces(state, props);
  // Sync stuff
  // @ts-expect-error -- TSCONVERSION https://github.com/reduxjs/reselect#accessing-react-props-in-selectors
  const syncItems = selectSyncItems(state, props);
  // Api spec stuff
  const activeApiSpec = apiSpecs.find(s => s.parentId === activeWorkspace._id);
  // Test stuff
  // @ts-expect-error -- TSCONVERSION https://github.com/reduxjs/reselect#accessing-react-props-in-selectors
  const activeUnitTests = selectActiveUnitTests(state, props);
  // @ts-expect-error -- TSCONVERSION https://github.com/reduxjs/reselect#accessing-react-props-in-selectors
  const activeUnitTestSuite = selectActiveUnitTestSuite(state, props);
  // @ts-expect-error -- TSCONVERSION https://github.com/reduxjs/reselect#accessing-react-props-in-selectors
  const activeUnitTestSuites = selectActiveUnitTestSuites(state, props);
  // @ts-expect-error -- TSCONVERSION https://github.com/reduxjs/reselect#accessing-react-props-in-selectors
  const activeUnitTestResult = selectActiveUnitTestResult(state, props);
  return Object.assign({}, state, {
    activity: activeActivity,
    activeSpace,
    activeApiSpec,
    activeCookieJar,
    activeEnvironment,
    activeGitRepository,
    activeRequest,
    activeRequestResponses,
    activeResponse,
    activeUnitTestResult,
    activeUnitTestSuite,
    activeUnitTestSuites,
    activeUnitTests,
    activeWorkspace,
    activeWorkspaceClientCertificates,
    activeWorkspaceMeta,
    apiSpecs,
    environments,
    gitRepositories,
    isLoading,
    isLoggedIn,
    loadStartTime,
    oAuth2Token,
    paneHeight,
    paneWidth,
    requestGroups,
    requestMetas,
    requestVersions,
    requests,
    responseDownloadPath,
    responseFilter,
    responseFilterHistory,
    responsePreviewMode,
    settings,
    sidebarChildren,
    sidebarFilter,
    sidebarHidden,
    sidebarWidth,
    syncItems,
    unseenWorkspaces,
    workspaceChildren,
    workspaces,
    workspaceMetas,
  });
}

function mapDispatchToProps(dispatch) {
  // @ts-expect-error -- TSCONVERSION
  const global: any = bindActionCreators(globalActions, dispatch);
  const entities = bindActionCreators(entitiesActions, dispatch);
  return {
    handleStartLoading: global.loadRequestStart,
    handleStopLoading: global.loadRequestStop,
    handleSetActiveActivity: global.setActiveActivity,
    handleGoToNextActivity: global.goToNextActivity,
    handleSetActiveWorkspace: global.setActiveWorkspace,
    handleImportFileToWorkspace: global.importFile,
    handleImportClipBoardToWorkspace: global.importClipBoard,
    handleImportUriToWorkspace: global.importUri,
    handleCommand: global.newCommand,
    handleExportFile: global.exportWorkspacesToFile,
    handleExportRequestsToFile: global.exportRequestsToFile,
    handleInitializeEntities: entities.initialize,
    handleMoveDoc: _moveDoc,
  };
}

async function _moveDoc(docToMove, parentId, targetId, targetOffset) {
  // Nothing to do. We are in the same spot as we started
  if (docToMove._id === targetId) {
    return;
  }

  // Don't allow dragging things into itself or children. This will disconnect
  // the node from the tree and cause the item to no longer show in the UI.
  const descendents = await db.withDescendants(docToMove);

  for (const doc of descendents) {
    if (doc._id === parentId) {
      return;
    }
  }

  function __updateDoc(doc, patch) {
    // @ts-expect-error -- TSCONVERSION
    return models.getModel(docToMove.type).update(doc, patch);
  }

  if (targetId === null) {
    // We are moving to an empty area. No sorting required
    await __updateDoc(docToMove, {
      parentId,
    });
    return;
  }

  // NOTE: using requestToTarget's parentId so we can switch parents!
  const docs = [
    ...(await models.request.findByParentId(parentId)),
    ...(await models.grpcRequest.findByParentId(parentId)),
    ...(await models.requestGroup.findByParentId(parentId)),
  ].sort((a, b) => (a.metaSortKey < b.metaSortKey ? -1 : 1));

  // Find the index of doc B so we can re-order and save everything
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];

    if (doc._id === targetId) {
      let before, after;

      if (targetOffset < 0) {
        // We're moving to below
        before = docs[i];
        after = docs[i + 1];
      } else {
        // We're moving to above
        before = docs[i - 1];
        after = docs[i];
      }

      const beforeKey = before ? before.metaSortKey : docs[0].metaSortKey - 100;
      const afterKey = after ? after.metaSortKey : docs[docs.length - 1].metaSortKey + 100;

      if (Math.abs(afterKey - beforeKey) < 0.000001) {
        // If sort keys get too close together, we need to redistribute the list. This is
        // not performant at all (need to update all siblings in DB), but it is extremely rare
        // anyway
        console.log(`[app] Recreating Sort Keys ${beforeKey} ${afterKey}`);
        await db.bufferChanges(300);
        docs.map((r, i) =>
          __updateDoc(r, {
            metaSortKey: i * 100,
            parentId,
          }),
        );
      } else {
        const metaSortKey = afterKey - (afterKey - beforeKey) / 2;

        __updateDoc(docToMove, {
          metaSortKey,
          parentId,
        });
      }

      break;
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(withDragDropContext(App));
