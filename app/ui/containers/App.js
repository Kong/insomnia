import React, {Component, PropTypes} from 'react';
import {ipcRenderer} from 'electron';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import HTML5Backend from 'react-dnd-html5-backend';
import {DragDropContext} from 'react-dnd';
import Mousetrap from '../mousetrap';
import {toggleModal, showModal} from '../components/modals';
import Wrapper from '../components/Wrapper';
import WorkspaceEnvironmentsEditModal from '../components/modals/WorkspaceEnvironmentsEditModal';
import Toast from '../components/Toast';
import CookiesModal from '../components/modals/CookiesModal';
import RequestSwitcherModal from '../components/modals/RequestSwitcherModal';
import PromptModal from '../components/modals/PromptModal';
import ChangelogModal from '../components/modals/ChangelogModal';
import SettingsModal from '../components/modals/SettingsModal';
import {MAX_PANE_WIDTH, MIN_PANE_WIDTH, DEFAULT_PANE_WIDTH, MAX_SIDEBAR_REMS, MIN_SIDEBAR_REMS, DEFAULT_SIDEBAR_WIDTH, getAppVersion, PREVIEW_MODE_SOURCE} from '../../common/constants';
import * as globalActions from '../redux/modules/global';
import * as db from '../../common/database';
import * as models from '../../models';
import {trackEvent, trackLegacyEvent} from '../../analytics';
import {selectEntitiesLists, selectActiveWorkspace, selectSidebarChildren, selectWorkspaceRequestsAndRequestGroups, selectActiveRequestMeta, selectActiveRequest, selectActiveWorkspaceMeta} from '../redux/selectors';
import RequestCreateModal from '../components/modals/RequestCreateModal';
import GenerateCodeModal from '../components/modals/GenerateCodeModal';
import WorkspaceSettingsModal from '../components/modals/WorkspaceSettingsModal';
import * as network from '../../common/network';
import {debounce} from '../../common/misc';


class App extends Component {
  constructor (props) {
    super(props);
    this.state = {
      draggingSidebar: false,
      draggingPane: false,
      sidebarWidth: props.sidebarWidth || DEFAULT_SIDEBAR_WIDTH,
      paneWidth: props.paneWidth || DEFAULT_PANE_WIDTH,
    };
  }

  _globalKeyMap = {

    // Show Settings
    'mod+,': () => {
      // NOTE: This is controlled via a global menu shortcut in app.js
    },

    // Show Settings
    'mod+shift+,': () => {
      // NOTE: This is controlled via a global menu shortcut in app.js
      const {activeWorkspace} = this.props;
      toggleModal(WorkspaceSettingsModal, activeWorkspace);
      trackEvent('HotKey', 'Workspace Settings');
    },

    // Show Request Switcher
    'mod+p': () => {
      toggleModal(RequestSwitcherModal);
      trackEvent('HotKey', 'Quick Switcher');
    },

    // Request Send
    'mod+enter': () => {
      const {activeRequest, activeEnvironment} = this.props;
      this._handleSendRequestWithEnvironment(
        activeRequest ? activeRequest._id : 'n/a',
        activeEnvironment ? activeEnvironment._id : 'n/a',
      );
      trackEvent('HotKey', 'Send');
    },

    // Edit Workspace Environments
    'mod+e': () => {
      const {activeWorkspace} = this.props;
      toggleModal(WorkspaceEnvironmentsEditModal, activeWorkspace);
      trackEvent('HotKey', 'Environments');
    },

    // Focus URL Bar
    'mod+l': () => {
      const node = document.body.querySelector('.urlbar input');
      node && node.focus();
      trackEvent('HotKey', 'Url');
    },

    // Edit Cookies
    'mod+k': () => {
      const {activeWorkspace} = this.props;
      toggleModal(CookiesModal, activeWorkspace);
      trackEvent('HotKey', 'Cookies');
    },

    // Request Create
    'mod+n': () => {
      const {activeRequest, activeWorkspace} = this.props;

      const parentId = activeRequest ? activeRequest.parentId : activeWorkspace._id;
      this._requestCreate(parentId);
      trackEvent('HotKey', 'Request Create');
    },

    // Request Duplicate
    'mod+d': async () => {
      this._requestDuplicate(this.props.activeRequest);
      trackEvent('HotKey', 'Request Duplicate');
    }
  };

  _setRequestPaneRef = n => this._requestPane = n;
  _setResponsePaneRef = n => this._responsePane = n;
  _setSidebarRef = n => this._sidebar = n;

  _requestGroupCreate = async (parentId) => {
    const name = await showModal(PromptModal, {
      headerName: 'New Folder',
      defaultValue: 'My Folder',
      submitName: 'Create',
      label: 'Name',
      selectText: true
    });

    models.requestGroup.create({parentId, name})
  };

  _requestCreate = async (parentId) => {
    const request = await showModal(RequestCreateModal, {parentId});
    this._handleSetActiveRequest(request._id)
  };

  _requestGroupDuplicate = async requestGroup => {
    models.requestGroup.duplicate(requestGroup);
  };

  _requestDuplicate = async request => {
    if (!request) {
      return;
    }

    const newRequest = await models.request.duplicate(request);
    this._handleSetActiveRequest(newRequest._id)
  };

  _handleGenerateCode = () => {
    showModal(GenerateCodeModal, this.props.activeRequest);
  };

  _updateRequestGroupMetaByParentId = async (requestGroupId, patch) => {
    const requestGroupMeta = await models.requestGroupMeta.getByParentId(requestGroupId);
    if (requestGroupMeta) {
      await models.requestGroupMeta.update(requestGroupMeta, patch);
    } else {
      const newPatch = Object.assign({parentId: requestGroupId}, patch);
      await models.requestGroupMeta.create(newPatch);
    }
  };

  _updateActiveWorkspaceMeta = async (patch) => {
    const workspaceId = this.props.activeWorkspace._id;
    const requestMeta = await models.workspaceMeta.getByParentId(workspaceId);
    if (requestMeta) {
      await models.workspaceMeta.update(requestMeta, patch);
    } else {
      const newPatch = Object.assign({parentId: workspaceId}, patch);
      await models.workspaceMeta.create(newPatch);
    }
  };

  _updateRequestMetaByParentId = async (requestId, patch) => {
    const requestMeta = await models.requestMeta.getByParentId(requestId);
    if (requestMeta) {
      await models.requestMeta.update(requestMeta, patch);
    } else {
      const newPatch = Object.assign({parentId: requestId}, patch);
      await models.requestMeta.create(newPatch);
    }
  };

  _savePaneWidth = debounce(paneWidth => this._updateActiveWorkspaceMeta({paneWidth}));
  _handleSetPaneWidth = paneWidth => {
    this.setState({paneWidth});
    this._savePaneWidth(paneWidth);
  };

  _handleSetActiveRequest = activeRequestId => {
    this._updateActiveWorkspaceMeta({activeRequestId});
  };

  _handleSetActiveEnvironment = activeEnvironmentId => {
    this._updateActiveWorkspaceMeta({activeEnvironmentId});
  };

  _saveSidebarWidth = debounce(sidebarWidth => this._updateActiveWorkspaceMeta({sidebarWidth}));
  _handleSetSidebarWidth = sidebarWidth => {
    this.setState({sidebarWidth});
    this._saveSidebarWidth(sidebarWidth);
  };

  _handleSetSidebarHidden = sidebarHidden => {
    this._updateActiveWorkspaceMeta({sidebarHidden});
  };

  _handleSetSidebarFilter = sidebarFilter => {
    this._updateActiveWorkspaceMeta({sidebarFilter});
  };

  _handleSetRequestGroupCollapsed = (requestGroupId, collapsed) => {
    this._updateRequestGroupMetaByParentId(requestGroupId, {collapsed});
  };

  _handleSetResponsePreviewMode = (requestId, previewMode) => {
    this._updateRequestMetaByParentId(requestId, {previewMode});
  };

  _handleSetResponseFilter = (requestId, responseFilter) => {
    this._updateRequestMetaByParentId(requestId, {responseFilter});
  };

  _handleSendRequestWithEnvironment = async (requestId, environmentId) => {
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
      await network.send(requestId, environmentId);
    } catch (e) {
      // It's OK
    }

    // Unset active response because we just made a new one
    await this._updateRequestMetaByParentId(requestId, {activeResponseId: null});

    // Stop loading
    this.props.handleStopLoading(requestId);
  };

  _handleSetActiveResponse = (requestId, activeResponseId) => {
    this._updateRequestMetaByParentId(requestId, {activeResponseId});
  };

  _requestCreateForWorkspace = () => {
    this._requestCreate(this.props.activeWorkspace._id);
  };

  _startDragSidebar = () => {
    trackEvent('Sidebar', 'Drag');
    this.setState({draggingSidebar: true})
  };

  _resetDragSidebar = () => {
    trackEvent('Sidebar', 'Drag');
    // TODO: Remove setTimeout need be not triggering drag on double click
    setTimeout(() => this._handleSetSidebarWidth(DEFAULT_SIDEBAR_WIDTH), 50);
  };

  _startDragPane = () => {
    trackEvent('App Pane', 'Drag Start');
    this.setState({draggingPane: true})
  };

  _resetDragPane = () => {
    trackEvent('App Pane', 'Drag Reset');
    // TODO: Remove setTimeout need be not triggering drag on double click
    setTimeout(() => this._handleSetPaneWidth(DEFAULT_PANE_WIDTH), 50);
  };

  _handleMouseMove = (e) => {
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
  };

  _handleMouseUp = () => {
    if (this.state.draggingSidebar) {
      this.setState({draggingSidebar: false});
    }

    if (this.state.draggingPane) {
      this.setState({draggingPane: false});
    }
  };

  _handleToggleSidebar = () => {
    const sidebarHidden = !this.props.sidebarHidden;
    this._handleSetSidebarHidden(sidebarHidden);
    trackEvent('Sidebar', 'Toggle Visibility', sidebarHidden ? 'Hide' : 'Show');
  };

  _setWrapperRef = n => {
    this._wrapper = n;
  };

  async componentDidMount () {
    // Bind mouse handlers
    document.addEventListener('mouseup', this._handleMouseUp);
    document.addEventListener('mousemove', this._handleMouseMove);

    // Map global keyboard shortcuts
    Object.keys(this._globalKeyMap).map(key => {
      Mousetrap.bindGlobal(key.split('|'), this._globalKeyMap[key]);
    });

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

    db.onChange(changes => {
      for (const change of changes) {
        const [event, doc, fromSync] = change;
        const {activeRequest} = this.props;

        // No active request, so we don't need to force refresh anything
        if (!activeRequest) {
          return;
        }

        // Force refresh if environment changes
        if (doc.type === models.environment.type) {
          this._wrapper.forceRequestPaneRefresh();
        }

        // Force refresh if sync changes the active request
        if (fromSync && doc._id === activeRequest._id) {
          this._wrapper.forceRequestPaneRefresh();
          console.log('[App] Forcing update');
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
    // Remove mouse handlers
    document.removeEventListener('mouseup', this._handleMouseUp);
    document.removeEventListener('mousemove', this._handleMouseMove);

    // Unbind global keyboard shortcuts
    Mousetrap.unbind();
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
          handleDuplicateRequest={this._requestDuplicate}
          handleDuplicateRequestGroup={this._requestGroupDuplicate}
          handleCreateRequestGroup={this._requestGroupCreate}
          handleGenerateCode={this._handleGenerateCode}
          handleSetResponsePreviewMode={this._handleSetResponsePreviewMode}
          handleSetResponseFilter={this._handleSetResponseFilter}
          handleSendRequestWithEnvironment={this._handleSendRequestWithEnvironment}
          handleSetActiveResponse={this._handleSetActiveResponse}
          handleSetActiveRequest={this._handleSetActiveRequest}
          handleSetActiveEnvironment={this._handleSetActiveEnvironment}
          handleSetSidebarFilter={this._handleSetSidebarFilter}
        />
        <Toast/>
      </div>
    )
  }
}

function mapStateToProps (state, props) {
  const {
    entities,
    global
  } = state;

  const {
    isLoading,
    loadingRequestIds,
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
      workspaceChildren,
    }
  );
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
    handleMoveRequestGroup: _moveRequestGroup,
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
        const metaSortKey = afterKey - (afterKey - beforeKey) / 2;
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
        const metaSortKey = afterKey - (afterKey - beforeKey) / 2;
        models.request.update(requestToMove, {metaSortKey, parentId});
      }

      break;
    }
  }
}

const reduxApp = connect(mapStateToProps, mapDispatchToProps)(App);
export default DragDropContext(HTML5Backend)(reduxApp);

