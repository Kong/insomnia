import React, {Component, PropTypes} from 'react';
import {ipcRenderer} from 'electron';
import ReactDOM from 'react-dom';
import * as importers from 'insomnia-importers';
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
import {MAX_PANE_WIDTH, MIN_PANE_WIDTH, DEFAULT_PANE_WIDTH, MAX_SIDEBAR_REMS, MIN_SIDEBAR_REMS, DEFAULT_SIDEBAR_WIDTH, getAppVersion} from '../../common/constants';
import * as globalActions from '../redux/modules/global';
import * as workspaceMetaActions from '../redux/modules/workspaceMeta';
import * as requestMetaActions from '../redux/modules/requestMeta';
import * as requestGroupMetaActions from '../redux/modules/requestGroupMeta';
import * as db from '../../common/database';
import * as models from '../../models';
import {importRaw} from '../../common/import';
import {trackEvent, trackLegacyEvent} from '../../analytics';
import {PREVIEW_MODE_SOURCE} from '../../common/constants';


class App extends Component {
  constructor (props) {
    super(props);
    this.state = {
      draggingSidebar: false,
      draggingPane: false,
      forceRefreshCounter: 0,
    };

    // Bind functions once, so we don't have to on every render
    this._boundStartDragSidebar = this._startDragSidebar.bind(this);
    this._boundResetDragSidebar = this._resetDragSidebar.bind(this);
    this._boundStartDragPane = this._startDragPane.bind(this);
    this._boundResetDragPane = this._resetDragPane.bind(this);
    this._boundHandleUrlChange = this._handleUrlChanged.bind(this);
    this._boundRequestCreate = this._requestCreate.bind(this);
    this._boundRequestGroupCreate = this._requestGroupCreate.bind(this);

    this.globalKeyMap = {

      // Show Settings
      'mod+,': () => {
        // NOTE: This is controlled via a global menu shortcut in app.js
      },

      // Show Request Switcher
      'mod+p': () => {
        toggleModal(RequestSwitcherModal);
      },

      // Request Send
      'mod+enter': () => {
        const {handleSendRequestWithEnvironment, activeRequest, activeEnvironment} = this.props;
        handleSendRequestWithEnvironment(
          activeRequest ? activeRequest._id : 'n/a',
          activeEnvironment ? activeEnvironment._id : 'n/a',
        );
      },

      // Edit Workspace Environments
      'mod+e': () => {
        const {activeWorkspace} = this.props;
        toggleModal(WorkspaceEnvironmentsEditModal, activeWorkspace);
      },

      // Focus URL Bar
      'mod+l': () => {
        const node = document.body.querySelector('.urlbar input');
        node && node.focus();
      },

      // Edit Cookies
      'mod+k': () => {
        const {activeWorkspace} = this.props;
        toggleModal(CookiesModal, activeWorkspace);
      },

      // Request Create
      'mod+n': () => {
        const {activeRequest, activeWorkspace} = this.props;

        const parentId = activeRequest ? activeRequest.parentId : activeWorkspace._id;
        this._requestCreate(parentId);
      },

      // Request Duplicate
      'mod+d': async () => {
        const {activeWorkspace, activeRequest, handleSetActiveRequest} = this.props;

        if (!activeRequest) {
          return;
        }

        const request = await models.request.duplicate(activeRequest);
        handleSetActiveRequest(activeWorkspace._id, request._id)
      }
    }
  }

  async _requestGroupCreate (parentId) {
    const name = await showModal(PromptModal, {
      headerName: 'Create New Folder',
      defaultValue: 'My Folder',
      selectText: true
    });

    models.requestGroup.create({parentId, name})
  }

  async _requestCreate (parentId) {
    const name = await showModal(PromptModal, {
      headerName: 'Create New Request',
      defaultValue: 'My Request',
      selectText: true
    });

    const {activeWorkspace, handleSetActiveRequest} = this.props;
    const request = await models.request.create({parentId, name});

    handleSetActiveRequest(activeWorkspace._id, request._id);
  }

  async _handleUrlChanged (request, url) {
    // Allow user to paste any import file into the url. If it results in
    // only one item, it will overwrite the current request.

    try {
      const {resources} = importers.import(url);
      const r = resources[0];
      if (r && r._type === 'request') {
        const cookieHeaders = r.cookies.map(({name, value}) => (
          {name: 'cookie', value: `${name}=${value}`}
        ));

        // Only pull fields that we want to update
        await models.request.update(request, {
          url: r.url,
          method: r.method,
          headers: [...r.headers, ...cookieHeaders],
          body: r.body,
          authentication: r.authentication,
          parameters: r.parameters,
        });

        this._forceHardRefresh();

        return;
      }
    } catch (e) {
      // Import failed, that's alright
    }

    models.request.update(request, {url});
  }

  _startDragSidebar () {
    this.setState({draggingSidebar: true})
  }

  _resetDragSidebar () {
    // TODO: Remove setTimeout need be not triggering drag on double click
    setTimeout(() => {
      const {handleSetSidebarWidth, activeWorkspace} = this.props;
      handleSetSidebarWidth(activeWorkspace._id, DEFAULT_SIDEBAR_WIDTH)
    }, 50);
  }

  _startDragPane () {
    this.setState({draggingPane: true})
  }

  _resetDragPane () {
    // TODO: Remove setTimeout need be not triggering drag on double click
    setTimeout(() => {
      const {handleSetPaneWidth, activeWorkspace} = this.props;
      handleSetPaneWidth(activeWorkspace._id, DEFAULT_PANE_WIDTH);
    }, 50);
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
      this.props.handleSetPaneWidth(this.props.activeWorkspace._id, paneWidth);

    } else if (this.state.draggingSidebar) {
      const currentPixelWidth = ReactDOM.findDOMNode(this._sidebar).offsetWidth;
      const ratio = e.clientX / currentPixelWidth;
      const width = this.props.sidebarWidth * ratio;
      let sidebarWidth = Math.max(Math.min(width, MAX_SIDEBAR_REMS), MIN_SIDEBAR_REMS);
      this.props.handleSetSidebarWidth(this.props.activeWorkspace._id, sidebarWidth);
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

  _handleToggleSidebar () {
    const {activeWorkspace, sidebarHidden, handleSetSidebarHidden} = this.props;
    handleSetSidebarHidden(activeWorkspace._id, !sidebarHidden);
  }

  _forceHardRefresh () {
    this.setState({forceRefreshCounter: this.state.forceRefreshCounter + 1});
  }

  async componentDidMount () {
    // Bind handlers before we use them
    this._handleMouseUp = this._handleMouseUp.bind(this);
    this._handleMouseMove = this._handleMouseMove.bind(this);

    // Bind mouse handlers
    document.addEventListener('mouseup', this._handleMouseUp);
    document.addEventListener('mousemove', this._handleMouseMove);

    // Map global keyboard shortcuts
    Object.keys(this.globalKeyMap).map(key => {
      Mousetrap.bindGlobal(key.split('|'), this.globalKeyMap[key]);
    });

    // Do The Analytics
    trackLegacyEvent('App Launched');

    // Update Stats Object
    const {lastVersion, launches} = await models.stats.get();
    const firstLaunch = !lastVersion;
    if (firstLaunch) {
      // TODO: Show a welcome message
      trackLegacyEvent('First Launch');
    } else if (lastVersion !== getAppVersion()) {
      trackEvent('General', 'Updated', getAppVersion());
      showModal(ChangelogModal);
    }

    db.onChange(changes => {
      for (const change of changes) {
        const [event, doc, fromSync] = change;

        // Not a sync-related change
        if (!fromSync) {
          return;
        }

        const {activeRequest} = this.props;

        // No active request at the moment, so it doesn't matter
        if (!activeRequest) {
          return;
        }

        // Only force the UI to refresh if the active Request changes
        // This is because things like the URL and Body editor don't update
        // when you tell them to.

        if (doc._id !== activeRequest._id) {
          return;
        }

        console.log('[App] Forcing update');

        // All sync-related changes to data force-refresh the app.
        this._forceHardRefresh();
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

    ipcRenderer.on('toggle-sidebar', this._handleToggleSidebar.bind(this));
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
          key={this.state.forceRefreshCounter}
          handleSetRequestPaneRef={n => this._requestPane = n}
          handleSetResponsePaneRef={n => this._responsePane = n}
          handleSetSidebarRef={n => this._sidebar = n}
          handleStartDragSidebar={this._boundStartDragSidebar}
          handleResetDragSidebar={this._boundResetDragSidebar}
          handleStartDragPane={this._boundStartDragPane}
          handleResetDragPane={this._boundResetDragPane}
          handleUpdateRequestUrl={this._boundHandleUrlChange}
          handleCreateRequest={this._boundRequestCreate}
          handleCreateRequestGroup={this._boundRequestGroupCreate}
          {...this.props}
        />
        <Toast/>
      </div>
    )
  }
}

function mapStateToProps (state) {
  const {
    entities,
    global,
    workspaceMeta,
    requestMeta,
    requestGroupMeta
  } = state;

  const {
    activeRequestIds,
    activeEnvironmentIds,
    sidebarHiddens,
    sidebarFilters,
    sidebarWidths,
    paneWidths
  } = workspaceMeta;

  const {
    loadingRequestIds,
    previewModes,
    responseFilters,
  } = requestMeta;

  const {
    isLoading,
  } = global;

  // Entities
  // TODO: Use selectors for these...
  const workspaces = Object.keys(entities.workspaces).map(id => entities.workspaces[id]);
  const environments = Object.keys(entities.environments).map(id => entities.environments[id]);
  const requests = Object.keys(entities.requests).map(id => entities.requests[id]);
  const requestGroups = Object.keys(entities.requestGroups).map(id => entities.requestGroups[id]);
  const settings = entities.settings[Object.keys(entities.settings)[0]];

  // Workspace stuff
  const activeWorkspace = entities.workspaces[global.activeWorkspaceId] || workspaces[0];
  const activeWorkspaceId = activeWorkspace._id;
  const sidebarHidden = !!sidebarHiddens[activeWorkspaceId];
  const sidebarFilter = sidebarFilters[activeWorkspaceId] || '';
  const sidebarWidth = sidebarWidths[activeWorkspaceId] || DEFAULT_SIDEBAR_WIDTH;
  const paneWidth = paneWidths[activeWorkspaceId] || DEFAULT_PANE_WIDTH;

  // Request stuff
  const activeRequestId = activeRequestIds[activeWorkspaceId];
  const activeRequest = entities.requests[activeRequestIds[activeWorkspaceId]];
  const responsePreviewMode = previewModes[activeRequestId] || PREVIEW_MODE_SOURCE;
  const responseFilter = responseFilters[activeRequestId] || '';

  // Environment stuff
  const activeEnvironmentId = activeEnvironmentIds[activeWorkspaceId];
  const activeEnvironment = entities.environments[activeEnvironmentId];

  // Find other meta things
  const loadStartTime = loadingRequestIds[activeRequestId] || -1;
  const sidebarChildren = _generateSidebarTree(
    activeWorkspace._id,
    requests.concat(requestGroups),
    requestGroupMeta.collapsed,
  );

  return Object.assign({}, state, {
      settings,
      workspaces,
      requestGroups,
      requests,
      isLoading,
      loadStartTime,
      activeWorkspace,
      activeRequest,
      sidebarHidden,
      sidebarFilter,
      sidebarWidth,
      responsePreviewMode,
      responseFilter,
      paneWidth,
      sidebarChildren,
      environments,
      activeEnvironment,
    }
  );
}

function mapDispatchToProps (dispatch) {
  const legacyActions = {
    global: bindActionCreators(globalActions, dispatch)
  };

  const workspace = bindActionCreators(workspaceMetaActions, dispatch);
  const requestGroups = bindActionCreators(requestGroupMetaActions, dispatch);
  const requests = bindActionCreators(requestMetaActions, dispatch);

  return {
    actions: legacyActions,
    handleSetPaneWidth: workspace.setPaneWidth,
    handleSetActiveRequest: workspace.setActiveRequest,
    handleSetActiveEnvironment: workspace.setActiveEnvironment,
    handleSetSidebarWidth: workspace.setSidebarWidth,
    handleSetSidebarHidden: workspace.setSidebarHidden,
    handleSetSidebarFilter: workspace.setSidebarFilter,
    handleSendRequestWithEnvironment: requests.send,
    handleSetResponsePreviewMode: requests.setPreviewMode,
    handleSetResponseFilter: requests.setResponseFilter,

    handleSetActiveWorkspace: legacyActions.global.setActiveWorkspace,
    handleImportFileToWorkspace: legacyActions.global.importFile,
    handleExportFile: legacyActions.global.exportFile,
    handleMoveRequest: _moveRequest,
    handleMoveRequestGroup: _moveRequestGroup,

    handleSetRequestGroupCollapsed: requestGroups.setCollapsed,
  };
}

function _generateSidebarTree (parentId, entities, collapsed) {
  const children = entities.filter(
    e => e.parentId === parentId
  ).sort((a, b) => {
    // Always sort folders above
    if (a.type === models.requestGroup.type && b.type !== models.requestGroup.type) {
      return -1;
    }

    if (a.metaSortKey === b.metaSortKey) {
      return a._id > b._id ? -1 : 1;
    } else {
      return a.metaSortKey < b.metaSortKey ? -1 : 1;
    }
  });

  if (children.length > 0) {
    return children.map(c => ({
      doc: c,
      children: _generateSidebarTree(c._id, entities, collapsed),
      collapsed: !!collapsed[c._id],
    }));
  } else {
    return children;
  }
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

