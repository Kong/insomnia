import React, {PureComponent, PropTypes} from 'react';
import autobind from 'autobind-decorator';
import fs from 'fs';
import {ipcRenderer} from 'electron';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {toggleModal, showModal} from '../components/modals';
import Wrapper from '../components/wrapper';
import WorkspaceEnvironmentsEditModal from '../components/modals/workspace-environments-edit-modal';
import Toast from '../components/toast';
import CookiesModal from '../components/modals/cookies-modal';
import RequestSwitcherModal from '../components/modals/request-switcher-modal';
import PromptModal from '../components/modals/prompt-modal';
import ChangelogModal from '../components/modals/changelog-modal';
import SettingsModal from '../components/modals/settings-modal';
import {MAX_PANE_WIDTH, MIN_PANE_WIDTH, DEFAULT_PANE_WIDTH, MAX_SIDEBAR_REMS, MIN_SIDEBAR_REMS, DEFAULT_SIDEBAR_WIDTH, getAppVersion, PREVIEW_MODE_SOURCE, isMac} from '../../common/constants';
import * as globalActions from '../redux/modules/global';
import * as db from '../../common/database';
import * as models from '../../models';
import {trackEvent, trackLegacyEvent} from '../../analytics';
import {selectEntitiesLists, selectActiveWorkspace, selectSidebarChildren, selectWorkspaceRequestsAndRequestGroups, selectActiveRequestMeta, selectActiveRequest, selectActiveWorkspaceMeta} from '../redux/selectors';
import RequestCreateModal from '../components/modals/request-create-modal';
import GenerateCodeModal from '../components/modals/generate-code-modal';
import WorkspaceSettingsModal from '../components/modals/workspace-settings-modal';
import * as network from '../../common/network';
import {debounce} from '../../common/misc';
import * as mime from 'mime-types';
import * as path from 'path';
import * as render from '../../common/render';

const KEY_ENTER = 13;
const KEY_COMMA = 188;
const KEY_D = 68;
const KEY_E = 69;
const KEY_K = 75;
const KEY_L = 76;
const KEY_N = 78;
const KEY_P = 80;

@autobind
class App extends PureComponent {
  constructor (props) {
    super(props);

    this.state = {
      draggingSidebar: false,
      draggingPane: false,
      sidebarWidth: props.sidebarWidth || DEFAULT_SIDEBAR_WIDTH,
      paneWidth: props.paneWidth || DEFAULT_PANE_WIDTH
    };

    this._getRenderContextCache = {};

    this._savePaneWidth = debounce(paneWidth => this._updateActiveWorkspaceMeta({paneWidth}));
    this._saveSidebarWidth = debounce(sidebarWidth => this._updateActiveWorkspaceMeta({sidebarWidth}));

    this._globalKeyMap = null;
  }

  _setGlobalKeyMap () {
    this._globalKeyMap = [
      { // Show Workspace Settings
        meta: true,
        shift: true,
        key: KEY_COMMA,
        callback: () => {
          const {activeWorkspace} = this.props;
          toggleModal(WorkspaceSettingsModal, activeWorkspace);
          trackEvent('HotKey', 'Workspace Settings');
        }
      }, {
        meta: true,
        shift: false,
        key: KEY_P,
        callback: () => {
          toggleModal(RequestSwitcherModal);
          trackEvent('HotKey', 'Quick Switcher');
        }
      }, {
        meta: true,
        shift: false,
        key: KEY_ENTER,
        callback: async e => {
          const {activeRequest, activeEnvironment} = this.props;
          await this._handleSendRequestWithEnvironment(
            activeRequest ? activeRequest._id : 'n/a',
            activeEnvironment ? activeEnvironment._id : 'n/a',
          );
          trackEvent('HotKey', 'Send');
        }
      }, {
        meta: true,
        shift: false,
        key: KEY_E,
        callback: () => {
          const {activeWorkspace} = this.props;
          toggleModal(WorkspaceEnvironmentsEditModal, activeWorkspace);
          trackEvent('HotKey', 'Environments');
        }
      }, {
        meta: true,
        shift: false,
        key: KEY_L,
        callback: () => {
          const node = document.body.querySelector('.urlbar input');
          node && node.focus();
          trackEvent('HotKey', 'Url');
        }
      }, {
        meta: true,
        shift: false,
        key: KEY_K,
        callback: () => {
          const {activeWorkspace} = this.props;
          toggleModal(CookiesModal, activeWorkspace);
          trackEvent('HotKey', 'Cookies');
        }
      }, {
        meta: true,
        shift: false,
        key: KEY_N,
        callback: async () => {
          const {activeRequest, activeWorkspace} = this.props;
          const parentId = activeRequest ? activeRequest.parentId : activeWorkspace._id;
          await this._requestCreate(parentId);
          trackEvent('HotKey', 'Request Create');
        }
      }, {
        meta: true,
        shift: false,
        key: KEY_D,
        callback: async () => {
          await this._requestDuplicate(this.props.activeRequest);
          trackEvent('HotKey', 'Request Duplicate');
        }
      }
    ];
  }

  _setRequestPaneRef (n) {
    this._requestPane = n;
  }

  _setResponsePaneRef (n) {
    this._responsePane = n;
  }

  _setSidebarRef (n) {
    this._sidebar = n;
  }

  async _requestGroupCreate (parentId) {
    const name = await showModal(PromptModal, {
      headerName: 'New Folder',
      defaultValue: 'My Folder',
      submitName: 'Create',
      label: 'Name',
      selectText: true
    });

    models.requestGroup.create({parentId, name});
  }

  async _requestCreate (parentId) {
    const request = await showModal(RequestCreateModal, {parentId});
    await this._handleSetActiveRequest(request._id);
  }

  async _requestGroupDuplicate (requestGroup) {
    models.requestGroup.duplicate(requestGroup);
  }

  async _requestDuplicate (request) {
    if (!request) {
      return;
    }

    const newRequest = await models.request.duplicate(request);
    await this._handleSetActiveRequest(newRequest._id);
  }

  /**
   * Heavily optimized render function
   *
   * @param text - template to render
   * @param strict - whether to fail on undefined context values
   * @param contextCacheKey - if rendering multiple times in parallel, set this
   * @returns {Promise}
   * @private
   */
  async _handleRenderText (text, strict = false, contextCacheKey = null) {
    if (!contextCacheKey || !this._getRenderContextCache[contextCacheKey]) {
      const {activeEnvironment, activeRequest} = this.props;
      const environmentId = activeEnvironment ? activeEnvironment._id : null;

      // NOTE: We're caching promises here to avoid race conditions
      this._getRenderContextCache[contextCacheKey] = render.getRenderContext(activeRequest, environmentId);
    }

    // Set timeout to delete the key eventually
    setTimeout(() => delete this._getRenderContextCache[contextCacheKey], 5000);

    const context = await this._getRenderContextCache[contextCacheKey];
    return render.render(text, context, strict);
  }

  _handleGenerateCodeForActiveRequest () {
    this._handleGenerateCode(this.props.activeRequest);
  }

  _handleGenerateCode (request) {
    showModal(GenerateCodeModal, request);
  }

  async _updateRequestGroupMetaByParentId (requestGroupId, patch) {
    const requestGroupMeta = await models.requestGroupMeta.getByParentId(requestGroupId);
    if (requestGroupMeta) {
      await models.requestGroupMeta.update(requestGroupMeta, patch);
    } else {
      const newPatch = Object.assign({parentId: requestGroupId}, patch);
      await models.requestGroupMeta.create(newPatch);
    }
  }

  async _updateActiveWorkspaceMeta (patch) {
    const workspaceId = this.props.activeWorkspace._id;
    const requestMeta = await models.workspaceMeta.getByParentId(workspaceId);
    if (requestMeta) {
      await models.workspaceMeta.update(requestMeta, patch);
    } else {
      const newPatch = Object.assign({parentId: workspaceId}, patch);
      await models.workspaceMeta.create(newPatch);
    }
  }

  async _updateRequestMetaByParentId (requestId, patch) {
    const requestMeta = await models.requestMeta.getByParentId(requestId);
    if (requestMeta) {
      await models.requestMeta.update(requestMeta, patch);
    } else {
      const newPatch = Object.assign({parentId: requestId}, patch);
      await models.requestMeta.create(newPatch);
    }
  }

  _handleSetPaneWidth (paneWidth) {
    this.setState({paneWidth});
    this._savePaneWidth(paneWidth);
  }

  async _handleSetActiveRequest (activeRequestId) {
    await this._updateActiveWorkspaceMeta({activeRequestId});
  }

  async _handleSetActiveEnvironment (activeEnvironmentId) {
    await this._updateActiveWorkspaceMeta({activeEnvironmentId});
    this._wrapper._forceRequestPaneRefresh();
  }

  _handleSetSidebarWidth (sidebarWidth) {
    this.setState({sidebarWidth});
    this._saveSidebarWidth(sidebarWidth);
  }

  async _handleSetSidebarHidden (sidebarHidden) {
    await this._updateActiveWorkspaceMeta({sidebarHidden});
  }

  async _handleSetSidebarFilter (sidebarFilter) {
    await this._updateActiveWorkspaceMeta({sidebarFilter});
  }

  _handleSetRequestGroupCollapsed (requestGroupId, collapsed) {
    this._updateRequestGroupMetaByParentId(requestGroupId, {collapsed});
  }

  _handleSetResponsePreviewMode (requestId, previewMode) {
    this._updateRequestMetaByParentId(requestId, {previewMode});
  }

  _handleSetResponseFilter (requestId, responseFilter) {
    this._updateRequestMetaByParentId(requestId, {responseFilter});
  }

  async _handleSendAndDownloadRequestWithEnvironment (requestId, environmentId, dir) {
    const request = await models.request.getById(requestId);
    if (!request) {
      return;
    }

    // NOTE: Since request is by far the most popular event, we will throttle
    // it so that we only track it if the request has changed since the last one
    const key = request._id;
    if (this._sendRequestTrackingKey !== key) {
      trackEvent('Request', 'Send and Download');
      trackLegacyEvent('Request Send');
      this._sendRequestTrackingKey = key;
    }

    // Start loading
    this.props.handleStartLoading(requestId);

    try {
      const responsePatch = await network.send(requestId, environmentId);
      if (responsePatch.statusCode >= 200 && responsePatch.statusCode < 300) {
        const extension = mime.extension(responsePatch.contentType) || '';
        const name = request.name.replace(/\s/g, '-').toLowerCase();
        const filename = path.join(dir, `${name}.${extension}`);
        const partialResponse = Object.assign({}, responsePatch, {
          contentType: 'text/plain',
          body: `Saved to ${filename}`,
          encoding: 'utf8'
        });
        await models.response.create(partialResponse);
        fs.writeFile(filename, responsePatch.body, responsePatch.encoding);
      } else {
        await models.response.create(responsePatch);
      }
    } catch (e) {
      // It's OK
    }

    // Unset active response because we just made a new one
    await this._updateRequestMetaByParentId(requestId, {activeResponseId: null});

    // Stop loading
    this.props.handleStopLoading(requestId);
  }

  async _handleSendRequestWithEnvironment (requestId, environmentId) {
    const request = await models.request.getById(requestId);
    if (!request) {
      return;
    }

    // NOTE: Since request is by far the most popular event, we will throttle
    // it so that we only track it if the request has changed since the last noe
    const key = `${request._id}::${request.modified}`;
    if (this._sendRequestTrackingKey !== key) {
      trackEvent('Request', 'Send');
      trackLegacyEvent('Request Send');
      this._sendRequestTrackingKey = key;
    }

    this.props.handleStartLoading(requestId);

    try {
      const responsePatch = await network.send(requestId, environmentId);
      await models.response.create(responsePatch);
    } catch (e) {
      // It's OK
    }

    // Unset active response because we just made a new one
    await this._updateRequestMetaByParentId(requestId, {activeResponseId: null});

    // Stop loading
    this.props.handleStopLoading(requestId);
  }

  _handleSetActiveResponse (requestId, activeResponseId) {
    this._updateRequestMetaByParentId(requestId, {activeResponseId});
  }

  _requestCreateForWorkspace () {
    this._requestCreate(this.props.activeWorkspace._id);
  }

  _startDragSidebar () {
    trackEvent('Sidebar', 'Drag');
    this.setState({draggingSidebar: true});
  }

  _resetDragSidebar () {
    trackEvent('Sidebar', 'Drag');
    // TODO: Remove setTimeout need be not triggering drag on double click
    setTimeout(() => this._handleSetSidebarWidth(DEFAULT_SIDEBAR_WIDTH), 50);
  }

  _startDragPane () {
    trackEvent('App Pane', 'Drag Start');
    this.setState({draggingPane: true});
  }

  _resetDragPane () {
    trackEvent('App Pane', 'Drag Reset');
    // TODO: Remove setTimeout need be not triggering drag on double click
    setTimeout(() => this._handleSetPaneWidth(DEFAULT_PANE_WIDTH), 50);
  }

  _handleMouseMove (e) {
    if (this.state.draggingPane) {
      const requestPane = ReactDOM.findDOMNode(this._requestPane);
      const responsePane = ReactDOM.findDOMNode(this._responsePane);

      const requestPaneWidth = requestPane.offsetWidth;
      const responsePaneWidth = responsePane.offsetWidth;
      const pixelOffset = e.clientX - requestPane.offsetLeft;
      let paneWidth = pixelOffset / (requestPaneWidth + responsePaneWidth);
      paneWidth = Math.min(Math.max(paneWidth, MIN_PANE_WIDTH), MAX_PANE_WIDTH);
      this._handleSetPaneWidth(paneWidth);
    } else if (this.state.draggingSidebar) {
      const currentPixelWidth = ReactDOM.findDOMNode(this._sidebar).offsetWidth;
      const ratio = e.clientX / currentPixelWidth;
      const width = this.state.sidebarWidth * ratio;
      let sidebarWidth = Math.max(Math.min(width, MAX_SIDEBAR_REMS), MIN_SIDEBAR_REMS);
      this._handleSetSidebarWidth(sidebarWidth);
    }
  }

  _handleMouseUp () {
    if (this.state.draggingSidebar) {
      this.setState({draggingSidebar: false});
    }

    if (this.state.draggingPane) {
      this.setState({draggingPane: false});
    }
  }

  _handleKeyDown (e) {
    const isMetaPressed = isMac() ? e.metaKey : e.ctrlKey;
    const isShiftPressed = e.shiftKey;

    for (const {meta, shift, key, callback} of this._globalKeyMap) {
      if (meta && !isMetaPressed) {
        continue;
      }

      if (shift && !isShiftPressed) {
        continue;
      }

      if (key !== e.keyCode) {
        continue;
      }

      callback();
    }
  }

  async _handleToggleSidebar () {
    const sidebarHidden = !this.props.sidebarHidden;
    await this._handleSetSidebarHidden(sidebarHidden);
    trackEvent('Sidebar', 'Toggle Visibility', sidebarHidden ? 'Hide' : 'Show');
  }

  _setWrapperRef (n) {
    this._wrapper = n;
  }

  async componentDidMount () {
    // Bind mouse and key handlers
    document.addEventListener('mouseup', this._handleMouseUp);
    document.addEventListener('mousemove', this._handleMouseMove);
    document.addEventListener('keydown', this._handleKeyDown);
    this._setGlobalKeyMap();

    // Do The Analytics
    trackLegacyEvent('App Launched');

    // Update Stats Object
    const {lastVersion, launches} = await models.stats.get();
    const firstLaunch = !lastVersion;
    if (firstLaunch) {
      // TODO: Show a welcome message
      trackLegacyEvent('First Launch');
      trackEvent('General', 'First Launch', getAppVersion(), {nonInteraction: true});
    } else if (lastVersion !== getAppVersion()) {
      trackEvent('General', 'Updated', getAppVersion(), {nonInteraction: true});
      showModal(ChangelogModal);
    } else {
      trackEvent('General', 'Launched', getAppVersion(), {nonInteraction: true});
    }

    db.onChange(async changes => {
      for (const change of changes) {
        const [
          _, // eslint-disable-line no-unused-vars
          doc,
          fromSync
        ] = change;
        const {activeRequest} = this.props;

        // No active request, so we don't need to force refresh anything
        if (!activeRequest) {
          return;
        }

        // Force refresh if environment changes
        // TODO: Only do this for environments in this workspace (not easy because they're nested)
        if (doc.type === models.environment.type) {
          console.log('[App] Forcing update from environment change', change);
          this._wrapper._forceRequestPaneRefresh();
        }

        // Force refresh if sync changes the active request
        if (fromSync && doc._id === activeRequest._id) {
          this._wrapper._forceRequestPaneRefresh();
          console.log('[App] Forcing update from request change', change);
        }
      }
    });

    models.stats.update({
      launches: launches + 1,
      lastLaunch: Date.now(),
      lastVersion: getAppVersion()
    });

    ipcRenderer.on('toggle-preferences', () => {
      toggleModal(SettingsModal);
    });

    ipcRenderer.on('toggle-changelog', () => {
      toggleModal(ChangelogModal);
    });

    ipcRenderer.on('toggle-sidebar', this._handleToggleSidebar);
  }

  componentWillUnmount () {
    // Remove mouse and key handlers
    document.removeEventListener('mouseup', this._handleMouseUp);
    document.removeEventListener('mousemove', this._handleMouseMove);
    document.removeEventListener('keydown', this._handleKeyDown);
  }

  render () {
    return (
      <div className="app">
        <Wrapper
          {...this.props}
          ref={this._setWrapperRef}
          paneWidth={this.state.paneWidth}
          sidebarWidth={this.state.sidebarWidth}
          handleCreateRequestForWorkspace={this._requestCreateForWorkspace}
          handleSetRequestGroupCollapsed={this._handleSetRequestGroupCollapsed}
          handleActivateRequest={this._handleSetActiveRequest}
          handleSetRequestPaneRef={this._setRequestPaneRef}
          handleSetResponsePaneRef={this._setResponsePaneRef}
          handleSetSidebarRef={this._setSidebarRef}
          handleStartDragSidebar={this._startDragSidebar}
          handleResetDragSidebar={this._resetDragSidebar}
          handleStartDragPane={this._startDragPane}
          handleResetDragPane={this._resetDragPane}
          handleCreateRequest={this._requestCreate}
          handleRender={this._handleRenderText}
          handleDuplicateRequest={this._requestDuplicate}
          handleDuplicateRequestGroup={this._requestGroupDuplicate}
          handleCreateRequestGroup={this._requestGroupCreate}
          handleGenerateCode={this._handleGenerateCode}
          handleGenerateCodeForActiveRequest={this._handleGenerateCodeForActiveRequest}
          handleSetResponsePreviewMode={this._handleSetResponsePreviewMode}
          handleSetResponseFilter={this._handleSetResponseFilter}
          handleSendRequestWithEnvironment={this._handleSendRequestWithEnvironment}
          handleSendAndDownloadRequestWithEnvironment={this._handleSendAndDownloadRequestWithEnvironment}
          handleSetActiveResponse={this._handleSetActiveResponse}
          handleSetActiveRequest={this._handleSetActiveRequest}
          handleSetActiveEnvironment={this._handleSetActiveEnvironment}
          handleSetSidebarFilter={this._handleSetSidebarFilter}
        />
        <Toast/>
      </div>
    );
  }
}

App.propTypes = {
  // Required
  sidebarWidth: PropTypes.number.isRequired,
  paneWidth: PropTypes.number.isRequired,
  activeWorkspace: PropTypes.shape({
    _id: PropTypes.string.isRequired
  }).isRequired,

  // Optional
  activeRequest: PropTypes.object
};

function mapStateToProps (state, props) {
  const {
    entities,
    global
  } = state;

  const {
    isLoading,
    loadingRequestIds
  } = global;

  // Entities
  const entitiesLists = selectEntitiesLists(state, props);
  const {
    workspaces,
    environments,
    requests,
    requestGroups
  } = entitiesLists;

  const settings = entitiesLists.settings[0];

  // Workspace stuff

  const workspaceMeta = selectActiveWorkspaceMeta(state, props) || {};
  const activeWorkspace = selectActiveWorkspace(state, props);
  const sidebarHidden = workspaceMeta.sidebarHidden || false;
  const sidebarFilter = workspaceMeta.sidebarFilter || '';
  const sidebarWidth = workspaceMeta.sidebarWidth || DEFAULT_SIDEBAR_WIDTH;
  const paneWidth = workspaceMeta.paneWidth || DEFAULT_PANE_WIDTH;

  // Request stuff
  const requestMeta = selectActiveRequestMeta(state, props) || {};
  const activeRequest = selectActiveRequest(state, props);
  const responsePreviewMode = requestMeta.previewMode || PREVIEW_MODE_SOURCE;
  const responseFilter = requestMeta.responseFilter || '';
  const activeResponseId = requestMeta.activeResponseId || '';

  // Environment stuff
  const activeEnvironmentId = workspaceMeta.activeEnvironmentId;
  const activeEnvironment = entities.environments[activeEnvironmentId];

  // Find other meta things
  const loadStartTime = loadingRequestIds[activeRequest ? activeRequest._id : 'n/a'] || -1;
  const sidebarChildren = selectSidebarChildren(state, props);
  const workspaceChildren = selectWorkspaceRequestsAndRequestGroups(state, props);

  return Object.assign({}, state, {
    settings,
    workspaces,
    requestGroups,
    requests,
    isLoading,
    loadStartTime,
    activeWorkspace,
    activeRequest,
    activeResponseId,
    sidebarHidden,
    sidebarFilter,
    sidebarWidth,
    paneWidth,
    responsePreviewMode,
    responseFilter,
    sidebarChildren,
    environments,
    activeEnvironment,
    workspaceChildren
  });
}

function mapDispatchToProps (dispatch) {
  const global = bindActionCreators(globalActions, dispatch);

  return {
    handleStartLoading: global.loadRequestStart,
    handleStopLoading: global.loadRequestStop,

    handleSetActiveWorkspace: global.setActiveWorkspace,
    handleImportFileToWorkspace: global.importFile,
    handleExportFile: global.exportFile,
    handleMoveRequest: _moveRequest,
    handleMoveRequestGroup: _moveRequestGroup
  };
}

async function _moveRequestGroup (requestGroupToMove, requestGroupToTarget, targetOffset) {
  // Oh God, this function is awful...

  if (requestGroupToMove._id === requestGroupToTarget._id) {
    // Nothing to do
    return;
  }

  // NOTE: using requestToTarget's parentId so we can switch parents!
  let requestGroups = await models.requestGroup.findByParentId(requestGroupToTarget.parentId);
  requestGroups = requestGroups.sort((a, b) => a.metaSortKey < b.metaSortKey ? -1 : 1);

  // Find the index of request B so we can re-order and save everything
  for (let i = 0; i < requestGroups.length; i++) {
    const request = requestGroups[i];

    if (request._id === requestGroupToTarget._id) {
      let before, after;
      if (targetOffset < 0) {
        // We're moving to below
        before = requestGroups[i];
        after = requestGroups[i + 1];
      } else {
        // We're moving to above
        before = requestGroups[i - 1];
        after = requestGroups[i];
      }

      const beforeKey = before ? before.metaSortKey : requestGroups[0].metaSortKey - 100;
      const afterKey = after ? after.metaSortKey : requestGroups[requestGroups.length - 1].metaSortKey + 100;

      if (Math.abs(afterKey - beforeKey) < 0.000001) {
        // If sort keys get too close together, we need to redistribute the list. This is
        // not performant at all (need to update all siblings in DB), but it is extremely rare
        // anyway
        console.log(`-- Recreating Sort Keys ${beforeKey} ${afterKey} --`);

        db.bufferChanges(300);
        requestGroups.map((r, i) => {
          models.requestGroup.update(r, {
            metaSortKey: i * 100,
            parentId: requestGroupToTarget.parentId
          });
        });
      } else {
        const metaSortKey = afterKey - ((afterKey - beforeKey) / 2);
        models.requestGroup.update(requestGroupToMove, {
          metaSortKey,
          parentId: requestGroupToTarget.parentId
        });
      }

      break;
    }
  }
}

async function _moveRequest (requestToMove, parentId, targetId, targetOffset) {
  // Oh God, this function is awful...

  if (requestToMove._id === targetId) {
    // Nothing to do. We are in the same spot as we started
    return;
  }

  if (targetId === null) {
    // We are moving to an empty area. No sorting required
    models.request.update(requestToMove, {parentId});
    return;
  }

  // NOTE: using requestToTarget's parentId so we can switch parents!
  let requests = await models.request.findByParentId(parentId);
  requests = requests.sort((a, b) => a.metaSortKey < b.metaSortKey ? -1 : 1);

  // Find the index of request B so we can re-order and save everything
  for (let i = 0; i < requests.length; i++) {
    const request = requests[i];

    if (request._id === targetId) {
      let before, after;
      if (targetOffset < 0) {
        // We're moving to below
        before = requests[i];
        after = requests[i + 1];
      } else {
        // We're moving to above
        before = requests[i - 1];
        after = requests[i];
      }

      const beforeKey = before ? before.metaSortKey : requests[0].metaSortKey - 100;
      const afterKey = after ? after.metaSortKey : requests[requests.length - 1].metaSortKey + 100;

      if (Math.abs(afterKey - beforeKey) < 0.000001) {
        // If sort keys get too close together, we need to redistribute the list. This is
        // not performant at all (need to update all siblings in DB), but it is extremely rare
        // anyway
        console.log(`-- Recreating Sort Keys ${beforeKey} ${afterKey} --`);

        db.bufferChanges(300);
        requests.map((r, i) => {
          models.request.update(r, {metaSortKey: i * 100, parentId});
        });
      } else {
        const metaSortKey = afterKey - ((afterKey - beforeKey) / 2);
        models.request.update(requestToMove, {metaSortKey, parentId});
      }

      break;
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(App);
