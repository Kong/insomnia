import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import fs from 'fs';
import { clipboard, ipcRenderer, remote } from 'electron';
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
import {
  COLLAPSE_SIDEBAR_REMS,
  DEFAULT_PANE_HEIGHT,
  DEFAULT_PANE_WIDTH,
  DEFAULT_SIDEBAR_WIDTH,
  MAX_PANE_HEIGHT,
  MAX_PANE_WIDTH,
  MAX_SIDEBAR_REMS,
  MIN_PANE_HEIGHT,
  MIN_PANE_WIDTH,
  MIN_SIDEBAR_REMS,
  PREVIEW_MODE_SOURCE,
} from '../../common/constants';
import * as globalActions from '../redux/modules/global';
import * as db from '../../common/database';
import * as models from '../../models';
import {
  selectActiveCookieJar,
  selectActiveOAuth2Token,
  selectActiveRequest,
  selectActiveRequestMeta,
  selectActiveRequestResponses,
  selectActiveResponse,
  selectActiveWorkspace,
  selectActiveWorkspaceClientCertificates,
  selectActiveWorkspaceMeta,
  selectEntitiesLists,
  selectSidebarChildren,
  selectSyncItems,
  selectUnseenWorkspaces,
  selectWorkspaceRequestsAndRequestGroups,
} from '../redux/selectors';
import RequestCreateModal from '../components/modals/request-create-modal';
import GenerateCodeModal from '../components/modals/generate-code-modal';
import WorkspaceSettingsModal from '../components/modals/workspace-settings-modal';
import RequestSettingsModal from '../components/modals/request-settings-modal';
import RequestRenderErrorModal from '../components/modals/request-render-error-modal';
import * as network from '../../network/network';
import { debounce, getContentDispositionHeader, getDataDirectory } from '../../common/misc';
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
import AskModal from '../components/modals/ask-modal';
import { updateMimeType } from '../../models/request';
import MoveRequestGroupModal from '../components/modals/move-request-group-modal';
import * as themes from '../../plugins/misc';
import ExportRequestsModal from '../components/modals/export-requests-modal';
import FileSystemDriver from '../../sync/store/drivers/file-system-driver';
import VCS from '../../sync/vcs';
import SyncMergeModal from '../components/modals/sync-merge-modal';

@autobind
class App extends PureComponent {
  constructor(props) {
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
      forceRefreshCounter: 0,
      forceRefreshHeaderCounter: 0,
      isMigratingChildren: false,
    };

    this._getRenderContextPromiseCache = {};

    this._savePaneWidth = debounce(paneWidth => this._updateActiveWorkspaceMeta({ paneWidth }));
    this._savePaneHeight = debounce(paneHeight => this._updateActiveWorkspaceMeta({ paneHeight }));
    this._saveSidebarWidth = debounce(sidebarWidth =>
      this._updateActiveWorkspaceMeta({ sidebarWidth }),
    );

    this._globalKeyMap = null;
  }

  _setGlobalKeyMap() {
    this._globalKeyMap = [
      [
        hotKeyRefs.PREFERENCES_SHOW_GENERAL,
        () => {
          showModal(SettingsModal);
        },
      ],
      [
        hotKeyRefs.PREFERENCES_SHOW_KEYBOARD_SHORTCUTS,
        () => {
          showModal(SettingsModal, TAB_INDEX_SHORTCUTS);
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
          const request = await models.request.create({ parentId, name: 'New Request' });
          await this._handleSetActiveRequest(request._id);
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
            onDone: confirmed => {
              if (!confirmed) {
                return;
              }
              models.request.remove(activeRequest);
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
          if (!this.props.activeRequest) {
            return;
          }

          const metas = Object.values(this.props.entities.requestMetas).find(
            m => m.parentId === this.props.activeRequest._id,
          );

          await this._handleSetRequestPinned(this.props.activeRequest, !(metas && metas.pinned));
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

  _setRequestPaneRef(n) {
    this._requestPane = n;
  }

  _setResponsePaneRef(n) {
    this._responsePane = n;
  }

  _setSidebarRef(n) {
    this._sidebar = n;
  }

  _requestGroupCreate(parentId) {
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

  _requestCreate(parentId) {
    showModal(RequestCreateModal, {
      parentId,
      onComplete: request => {
        this._handleSetActiveRequest(request._id);
      },
    });
  }

  static async _requestGroupDuplicate(requestGroup) {
    showPrompt({
      title: 'Duplicate Folder',
      defaultValue: requestGroup.name,
      submitName: 'Create',
      label: 'New Name',
      selectText: true,
      onComplete: async name => {
        await models.requestGroup.duplicate(requestGroup, { name });
      },
    });
  }

  static async _requestGroupMove(requestGroup) {
    showModal(MoveRequestGroupModal, { requestGroup });
  }

  _requestDuplicate(request) {
    if (!request) {
      return;
    }

    showPrompt({
      title: 'Duplicate Request',
      defaultValue: request.name,
      submitName: 'Create',
      label: 'New Name',
      selectText: true,
      onComplete: async name => {
        const newRequest = await models.request.duplicate(request, { name });
        await this._handleSetActiveRequest(newRequest._id);
      },
    });
  }

  _workspaceDuplicate(callback) {
    const workspace = this.props.activeWorkspace;
    showPrompt({
      title: 'Duplicate Workspace',
      defaultValue: workspace.name,
      submitName: 'Create',
      selectText: true,
      label: 'New Name',
      onComplete: async name => {
        const newWorkspace = await db.duplicate(workspace, { name });
        await this.props.handleSetActiveWorkspace(newWorkspace._id);
        callback();
      },
    });
  }

  async _fetchRenderContext() {
    const { activeEnvironment, activeRequest, activeWorkspace } = this.props;
    const environmentId = activeEnvironment ? activeEnvironment._id : null;

    const ancestors = await db.withAncestors(activeRequest || activeWorkspace, [
      models.request.type,
      models.requestGroup.type,
      models.workspace.type,
    ]);

    return render.getRenderContext(activeRequest, environmentId, ancestors);
  }

  async _handleGetRenderContext() {
    const context = await this._fetchRenderContext();
    const keys = getKeys(context);
    return { context, keys };
  }

  /**
   * Heavily optimized render function
   *
   * @param text - template to render
   * @param contextCacheKey - if rendering multiple times in parallel, set this
   * @returns {Promise}
   * @private
   */
  async _handleRenderText(text, contextCacheKey = null) {
    if (!contextCacheKey || !this._getRenderContextPromiseCache[contextCacheKey]) {
      // NOTE: We're caching promises here to avoid race conditions
      this._getRenderContextPromiseCache[contextCacheKey] = this._fetchRenderContext();
    }

    // Set timeout to delete the key eventually
    setTimeout(() => delete this._getRenderContextPromiseCache[contextCacheKey], 5000);

    const context = await this._getRenderContextPromiseCache[contextCacheKey];
    return render.render(text, context);
  }

  _handleGenerateCodeForActiveRequest() {
    App._handleGenerateCode(this.props.activeRequest);
  }

  static _handleGenerateCode(request) {
    showModal(GenerateCodeModal, request);
  }

  async _handleCopyAsCurl(request) {
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
      const newPatch = Object.assign({ parentId: requestGroupId }, patch);
      await models.requestGroupMeta.create(newPatch);
    }
  }

  async _updateActiveWorkspaceMeta(patch) {
    const workspaceId = this.props.activeWorkspace._id;
    const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspaceId);
    if (workspaceMeta) {
      return models.workspaceMeta.update(workspaceMeta, patch);
    } else {
      const newPatch = Object.assign({ parentId: workspaceId }, patch);
      return models.workspaceMeta.create(newPatch);
    }
  }

  static async _updateRequestMetaByParentId(requestId, patch) {
    const requestMeta = await models.requestMeta.getByParentId(requestId);
    if (requestMeta) {
      return models.requestMeta.update(requestMeta, patch);
    } else {
      const newPatch = Object.assign({ parentId: requestId }, patch);
      return models.requestMeta.create(newPatch);
    }
  }

  _updateIsVariableUncovered() {
    this.setState({ isVariableUncovered: !this.state.isVariableUncovered });
  }

  _handleSetPaneWidth(paneWidth) {
    this.setState({ paneWidth });
    this._savePaneWidth(paneWidth);
  }

  _handleSetPaneHeight(paneHeight) {
    this.setState({ paneHeight });
    this._savePaneHeight(paneHeight);
  }

  async _handleSetActiveRequest(activeRequestId) {
    await this._updateActiveWorkspaceMeta({ activeRequestId });
    await App._updateRequestMetaByParentId(activeRequestId, { lastActive: Date.now() });
  }

  async _handleSetActiveEnvironment(activeEnvironmentId) {
    await this._updateActiveWorkspaceMeta({ activeEnvironmentId });

    // Give it time to update and re-render
    setTimeout(() => {
      this._wrapper && this._wrapper._forceRequestPaneRefresh();
    }, 300);
  }

  _handleSetSidebarWidth(sidebarWidth) {
    this.setState({ sidebarWidth });
    this._saveSidebarWidth(sidebarWidth);
  }

  async _handleSetSidebarHidden(sidebarHidden) {
    await this._updateActiveWorkspaceMeta({ sidebarHidden });
  }

  async _handleSetSidebarFilter(sidebarFilter) {
    await this._updateActiveWorkspaceMeta({ sidebarFilter });
  }

  _handleSetRequestGroupCollapsed(requestGroupId, collapsed) {
    App._updateRequestGroupMetaByParentId(requestGroupId, { collapsed });
  }

  async _handleSetRequestPinned(request, pinned) {
    App._updateRequestMetaByParentId(request._id, { pinned });
  }

  _handleSetResponsePreviewMode(requestId, previewMode) {
    App._updateRequestMetaByParentId(requestId, { previewMode });
  }

  _handleUpdateDownloadPath(requestId, downloadPath) {
    App._updateRequestMetaByParentId(requestId, { downloadPath });
  }

  async _handleSetResponseFilter(requestId, responseFilter) {
    await App._updateRequestMetaByParentId(requestId, { responseFilter });

    clearTimeout(this._responseFilterHistorySaveTimeout);
    this._responseFilterHistorySaveTimeout = setTimeout(async () => {
      const meta = await models.requestMeta.getByParentId(requestId);
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

  async _handleUpdateRequestMimeType(mimeType) {
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
        : {}; // Clear saved value in requestMeta

    await models.requestMeta.update(requestMeta, {
      savedRequestBody: saveValue,
    });

    const newRequest = await updateMimeType(this.props.activeRequest, mimeType, false, savedBody);

    // Force it to update, because other editor components (header editor)
    // needs to change. Need to wait a delay so the next render can finish
    setTimeout(() => {
      this.setState({ forceRefreshHeaderCounter: this.state.forceRefreshHeaderCounter + 1 });
    }, 500);

    return newRequest;
  }

  async _getDownloadLocation() {
    return new Promise(resolve => {
      const options = {
        title: 'Select Download Location',
        buttonLabel: 'Send and Save',
        defaultPath: window.localStorage.getItem('insomnia.sendAndDownloadLocation'),
      };

      remote.dialog.showSaveDialog(options, filename => {
        window.localStorage.setItem('insomnia.sendAndDownloadLocation', filename);
        resolve(filename);
      });
    });
  }

  async _handleSendAndDownloadRequestWithEnvironment(requestId, environmentId, dir) {
    const { settings, handleStartLoading, handleStopLoading } = this.props;

    const request = await models.request.getById(requestId);
    if (!request) {
      return;
    }

    // NOTE: Since request is by far the most popular event, we will throttle
    // it so that we only track it if the request has changed since the last one
    const key = request._id;
    if (this._sendRequestTrackingKey !== key) {
      this._sendRequestTrackingKey = key;
    }

    // Start loading
    handleStartLoading(requestId);

    try {
      const responsePatch = await network.send(requestId, environmentId);
      const headers = responsePatch.headers || [];
      const header = getContentDispositionHeader(headers);
      const nameFromHeader = header ? header.value : null;

      if (
        responsePatch.bodyPath &&
        responsePatch.statusCode >= 200 &&
        responsePatch.statusCode < 300
      ) {
        const extension = mime.extension(responsePatch.contentType) || 'unknown';
        const name =
          nameFromHeader || `${request.name.replace(/\s/g, '-').toLowerCase()}.${extension}`;

        let filename;
        if (dir) {
          filename = path.join(dir, name);
        } else {
          filename = await this._getDownloadLocation();
        }

        const to = fs.createWriteStream(filename);
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
    }

    // Unset active response because we just made a new one
    await App._updateRequestMetaByParentId(requestId, {
      activeResponseId: null,
    });

    // Stop loading
    handleStopLoading(requestId);
  }

  async _handleSendRequestWithEnvironment(requestId, environmentId) {
    const { handleStartLoading, handleStopLoading, settings } = this.props;
    const request = await models.request.getById(requestId);
    if (!request) {
      return;
    }

    // NOTE: Since request is by far the most popular event, we will throttle
    // it so that we only track it if the request has changed since the last noe
    const key = `${request._id}::${request.modified}`;
    if (this._sendRequestTrackingKey !== key) {
      this._sendRequestTrackingKey = key;
    }

    handleStartLoading(requestId);

    try {
      const responsePatch = await network.send(requestId, environmentId);
      await models.response.create(responsePatch, settings.maxHistoryResponses);
    } catch (err) {
      if (err.type === 'render') {
        showModal(RequestRenderErrorModal, { request, error: err });
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

  async _handleSetActiveResponse(requestId, activeResponse = null) {
    const { activeEnvironment } = this.props;
    const activeResponseId = activeResponse ? activeResponse._id : null;
    await App._updateRequestMetaByParentId(requestId, { activeResponseId });

    let response;
    if (activeResponseId) {
      response = await models.response.getById(activeResponseId);
    } else {
      const environmentId = activeEnvironment ? activeEnvironment._id : null;
      response = await models.response.getLatestForRequest(requestId, environmentId);
    }

    const requestVersionId = response ? response.requestVersionId : 'n/a';
    const request = await models.requestVersion.restore(requestVersionId);

    if (request) {
      // Refresh app to reflect changes. Using timeout because we need to
      // wait for the request update to propagate.
      setTimeout(() => this._wrapper._forceRequestPaneRefresh(), 500);
    } else {
      // Couldn't restore request. That's okay
    }
  }

  _requestCreateForWorkspace() {
    this._requestCreate(this.props.activeWorkspace._id);
  }

  _startDragSidebar() {
    this.setState({ draggingSidebar: true });
  }

  _resetDragSidebar() {
    // TODO: Remove setTimeout need be not triggering drag on double click
    setTimeout(() => this._handleSetSidebarWidth(DEFAULT_SIDEBAR_WIDTH), 50);
  }

  _startDragPaneHorizontal() {
    this.setState({ draggingPaneHorizontal: true });
  }

  _startDragPaneVertical() {
    this.setState({ draggingPaneVertical: true });
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
      if (!this.state.showDragOverlay && Math.abs(distance) > 0.02 /* % */) {
        this.setState({ showDragOverlay: true });
      }

      const requestPane = ReactDOM.findDOMNode(this._requestPane);
      const responsePane = ReactDOM.findDOMNode(this._responsePane);

      const requestPaneWidth = requestPane.offsetWidth;
      const responsePaneWidth = responsePane.offsetWidth;

      const pixelOffset = e.clientX - requestPane.offsetLeft;
      let paneWidth = pixelOffset / (requestPaneWidth + responsePaneWidth);
      paneWidth = Math.min(Math.max(paneWidth, MIN_PANE_WIDTH), MAX_PANE_WIDTH);

      this._handleSetPaneWidth(paneWidth);
    } else if (this.state.draggingPaneVertical) {
      // Only pop the overlay after we've moved it a bit (so we don't block doubleclick);
      const distance = this.props.paneHeight - this.state.paneHeight;
      if (!this.state.showDragOverlay && Math.abs(distance) > 0.02 /* % */) {
        this.setState({ showDragOverlay: true });
      }

      const requestPane = ReactDOM.findDOMNode(this._requestPane);
      const responsePane = ReactDOM.findDOMNode(this._responsePane);

      const requestPaneHeight = requestPane.offsetHeight;
      const responsePaneHeight = responsePane.offsetHeight;

      const pixelOffset = e.clientY - requestPane.offsetTop;
      let paneHeight = pixelOffset / (requestPaneHeight + responsePaneHeight);
      paneHeight = Math.min(Math.max(paneHeight, MIN_PANE_HEIGHT), MAX_PANE_HEIGHT);

      this._handleSetPaneHeight(paneHeight);
    } else if (this.state.draggingSidebar) {
      // Only pop the overlay after we've moved it a bit (so we don't block doubleclick);
      const distance = this.props.sidebarWidth - this.state.sidebarWidth;
      if (!this.state.showDragOverlay && Math.abs(distance) > 2 /* ems */) {
        this.setState({ showDragOverlay: true });
      }

      const sidebar = ReactDOM.findDOMNode(this._sidebar);
      const currentPixelWidth = sidebar.offsetWidth;
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
      this.setState({ draggingSidebar: false, showDragOverlay: false });
    }

    if (this.state.draggingPaneHorizontal) {
      this.setState({ draggingPaneHorizontal: false, showDragOverlay: false });
    }

    if (this.state.draggingPaneVertical) {
      this.setState({ draggingPaneVertical: false, showDragOverlay: false });
    }
  }

  _handleKeyDown(e) {
    for (const [definition, callback] of this._globalKeyMap) {
      executeHotKey(e, definition, callback);
    }
  }

  _handleToggleMenuBar(hide) {
    for (const win of remote.BrowserWindow.getAllWindows()) {
      if (win.isMenuBarAutoHide() !== hide) {
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

  _setWrapperRef(n) {
    this._wrapper = n;
  }

  async _handleReloadPlugins() {
    const { settings } = this.props;
    await plugins.reloadPlugins();
    templating.reload();
    themes.setTheme(settings.theme);
    console.log('[plugins] reloaded');
  }

  /**
   * Update document.title to be "Workspace (Environment) – Request"
   * @private
   */
  _updateDocumentTitle() {
    const { activeWorkspace, activeEnvironment, activeRequest } = this.props;

    let title = activeWorkspace.name;

    if (activeEnvironment) {
      title += ` (${activeEnvironment.name})`;
    }

    if (activeRequest) {
      title += ` – ${activeRequest.name}`;
    }

    document.title = title;
  }

  componentDidUpdate(prevProps) {
    this._updateDocumentTitle();

    // Force app refresh if login state changes
    if (prevProps.isLoggedIn !== this.props.isLoggedIn) {
      this.setState(state => ({
        forceRefreshCounter: state.forceRefreshCounter + 1,
      }));
    }
  }

  async _updateVCS(activeWorkspace) {
    // Get the vcs and set it to null in the state while we update it
    let vcs = this.state.vcs;
    this.setState({ vcs: null });

    if (!vcs) {
      const directory = path.join(getDataDirectory(), 'version-control');
      const driver = new FileSystemDriver({ directory });
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

    this.setState({ vcs });
  }

  async componentDidMount() {
    // Bind mouse and key handlers
    document.addEventListener('mouseup', this._handleMouseUp);
    document.addEventListener('mousemove', this._handleMouseMove);
    this._setGlobalKeyMap();

    // Update title
    this._updateDocumentTitle();

    // Update VCS
    await this._updateVCS(this.props.activeWorkspace);

    db.onChange(async changes => {
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
          this._wrapper && this._wrapper._forceRequestPaneRefresh();
        }, 300);
      }
    });

    ipcRenderer.on('toggle-preferences', () => {
      showModal(SettingsModal);
    });

    ipcRenderer.on('reload-plugins', this._handleReloadPlugins);

    ipcRenderer.on('toggle-preferences-shortcuts', () => {
      showModal(SettingsModal, TAB_INDEX_SHORTCUTS);
    });

    ipcRenderer.on('run-command', (e, commandUri) => {
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

        if (e.dataTransfer.files.length === 0) {
          console.log('[drag] Ignored drop event because no files present');
          return;
        }

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
  }

  componentWillUnmount() {
    // Remove mouse and key handlers
    document.removeEventListener('mouseup', this._handleMouseUp);
    document.removeEventListener('mousemove', this._handleMouseMove);
  }

  _ensureWorkspaceChildren(props) {
    const { activeWorkspace, activeCookieJar, environments } = props;
    const baseEnvironments = environments.filter(e => e.parentId === activeWorkspace._id);

    // Nothing to do
    if (baseEnvironments.length && activeCookieJar) {
      return;
    }

    // We already started migrating. Let it finish.
    if (this.state.isMigratingChildren) {
      return;
    }

    // Prevent rendering of everything
    this.setState({ isMigratingChildren: true }, async () => {
      const flushId = await db.bufferChanges();
      await models.environment.getOrCreateForWorkspace(activeWorkspace);
      await models.cookieJar.getOrCreateForParentId(activeWorkspace._id);
      await db.flushChanges(flushId);

      this.setState({ isMigratingChildren: false });
    });
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillReceiveProps(nextProps) {
    this._ensureWorkspaceChildren(nextProps);

    // Update VCS if needed
    const { activeWorkspace } = this.props;
    if (nextProps.activeWorkspace._id !== activeWorkspace._id) {
      this._updateVCS(nextProps.activeWorkspace);
    }
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillMount() {
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
      vcs,
      forceRefreshCounter,
      forceRefreshHeaderCounter,
    } = this.state;

    const uniquenessKey = `${forceRefreshCounter}::${activeWorkspace._id}`;

    return (
      <KeydownBinder onKeydown={this._handleKeyDown}>
        <div className="app" key={uniquenessKey}>
          <ErrorBoundary showAlert>
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
              handleSetActiveRequest={this._handleSetActiveRequest}
              handleSetActiveEnvironment={this._handleSetActiveEnvironment}
              handleSetSidebarFilter={this._handleSetSidebarFilter}
              handleToggleMenuBar={this._handleToggleMenuBar}
              handleUpdateRequestMimeType={this._handleUpdateRequestMimeType}
              handleShowExportRequestsModal={this._handleShowExportRequestsModal}
              handleUpdateDownloadPath={this._handleUpdateDownloadPath}
              isVariableUncovered={isVariableUncovered}
              headerEditorKey={forceRefreshHeaderCounter + ''}
              vcs={vcs}
            />
          </ErrorBoundary>

          <ErrorBoundary showAlert>
            <Toast />
          </ErrorBoundary>

          {/* Block all mouse activity by showing an overlay while dragging */}
          {this.state.showDragOverlay ? <div className="blocker-overlay" /> : null}
        </div>
      </KeydownBinder>
    );
  }
}

App.propTypes = {
  // Required
  sidebarWidth: PropTypes.number.isRequired,
  paneWidth: PropTypes.number.isRequired,
  paneHeight: PropTypes.number.isRequired,
  handleCommand: PropTypes.func.isRequired,
  settings: PropTypes.object.isRequired,
  isLoggedIn: PropTypes.bool.isRequired,
  activeWorkspace: PropTypes.shape({
    _id: PropTypes.string.isRequired,
  }).isRequired,
  handleSetActiveWorkspace: PropTypes.func.isRequired,

  // Optional
  activeRequest: PropTypes.object,
  activeEnvironment: PropTypes.shape({
    _id: PropTypes.string.isRequired,
  }),
};

function mapStateToProps(state, props) {
  const { entities, global } = state;

  const { isLoading, loadingRequestIds, isLoggedIn } = global;

  // Entities
  const entitiesLists = selectEntitiesLists(state, props);
  const {
    workspaces,
    environments,
    requests,
    requestGroups,
    requestMetas,
    requestVersions,
  } = entitiesLists;

  const settings = entitiesLists.settings[0];

  // Workspace stuff
  const workspaceMeta = selectActiveWorkspaceMeta(state, props) || {};
  const activeWorkspace = selectActiveWorkspace(state, props);
  const activeWorkspaceClientCertificates = selectActiveWorkspaceClientCertificates(state, props);
  const sidebarHidden = workspaceMeta.sidebarHidden || false;
  const sidebarFilter = workspaceMeta.sidebarFilter || '';
  const sidebarWidth = workspaceMeta.sidebarWidth || DEFAULT_SIDEBAR_WIDTH;
  const paneWidth = workspaceMeta.paneWidth || DEFAULT_PANE_WIDTH;
  const paneHeight = workspaceMeta.paneHeight || DEFAULT_PANE_HEIGHT;

  // Request stuff
  const requestMeta = selectActiveRequestMeta(state, props) || {};
  const activeRequest = selectActiveRequest(state, props);
  const responsePreviewMode = requestMeta.previewMode || PREVIEW_MODE_SOURCE;
  const responseFilter = requestMeta.responseFilter || '';
  const responseFilterHistory = requestMeta.responseFilterHistory || [];
  const responseDownloadPath = requestMeta.downloadPath || null;

  // Cookie Jar
  const activeCookieJar = selectActiveCookieJar(state, props);

  // Response stuff
  const activeRequestResponses = selectActiveRequestResponses(state, props) || [];
  const activeResponse = selectActiveResponse(state, props) || null;

  // Environment stuff
  const activeEnvironmentId = workspaceMeta.activeEnvironmentId;
  const activeEnvironment = entities.environments[activeEnvironmentId];

  // OAuth2Token stuff
  const oAuth2Token = selectActiveOAuth2Token(state, props);

  // Find other meta things
  const loadStartTime = loadingRequestIds[activeRequest ? activeRequest._id : 'n/a'] || -1;
  const sidebarChildren = selectSidebarChildren(state, props);
  const workspaceChildren = selectWorkspaceRequestsAndRequestGroups(state, props);
  const unseenWorkspaces = selectUnseenWorkspaces(state, props);

  // Sync stuff
  const syncItems = selectSyncItems(state, props);

  return Object.assign({}, state, {
    activeCookieJar,
    activeEnvironment,
    activeRequest,
    activeRequestResponses,
    activeResponse,
    activeWorkspace,
    activeWorkspaceClientCertificates,
    environments,
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
  });
}

function mapDispatchToProps(dispatch) {
  const global = bindActionCreators(globalActions, dispatch);

  return {
    handleStartLoading: global.loadRequestStart,
    handleStopLoading: global.loadRequestStop,

    handleSetActiveWorkspace: global.setActiveWorkspace,
    handleImportFileToWorkspace: global.importFile,
    handleImportClipBoardToWorkspace: global.importClipBoard,
    handleImportUriToWorkspace: global.importUri,
    handleCommand: global.newCommand,
    handleExportFile: global.exportWorkspacesToFile,
    handleExportRequestsToFile: global.exportRequestsToFile,
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
    models.getModel(docToMove.type).update(doc, patch);
  }

  if (targetId === null) {
    // We are moving to an empty area. No sorting required
    await __updateDoc(docToMove, { parentId });
    return;
  }

  // NOTE: using requestToTarget's parentId so we can switch parents!
  const docs = [
    ...(await models.request.findByParentId(parentId)),
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
        docs.map((r, i) => __updateDoc(r, { metaSortKey: i * 100, parentId }));
      } else {
        const metaSortKey = afterKey - (afterKey - beforeKey) / 2;
        __updateDoc(docToMove, { metaSortKey, parentId });
      }

      break;
    }
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(App);
