import React, {Component, PropTypes} from 'react';
import {ipcRenderer} from 'electron';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import HTML5Backend from 'react-dnd-html5-backend';
import {DragDropContext} from 'react-dnd';

import Mousetrap from '../lib/mousetrap';

import {addModal} from '../components/modals';
import WorkspaceEnvironmentsEditModal from '../components/modals/WorkspaceEnvironmentsEditModal';
import CookiesModal from '../components/modals/CookiesModal';
import EnvironmentEditModal from '../components/modals/EnvironmentEditModal';
import RequestSwitcherModal from '../components/modals/RequestSwitcherModal';
import GenerateCodeModal from '../components/modals/GenerateCodeModal';
import PromptModal from '../components/modals/PromptModal';
import AlertModal from '../components/modals/AlertModal';
import ChangelogModal from '../components/modals/ChangelogModal';
import SettingsModal from '../components/modals/SettingsModal';
import RequestPane from '../components/RequestPane';
import ResponsePane from '../components/ResponsePane';
import Sidebar from '../components/sidebar/Sidebar';
import {PREVIEW_MODE_FRIENDLY} from '../lib/previewModes';
import {
  MAX_PANE_WIDTH, MIN_PANE_WIDTH,
  DEFAULT_PANE_WIDTH,
  MAX_SIDEBAR_REMS,
  MIN_SIDEBAR_REMS,
  DEFAULT_SIDEBAR_WIDTH
} from '../lib/constants'

import * as GlobalActions from '../redux/modules/global';
import * as RequestActions from '../redux/modules/requests';

import * as db from '../database';
import {importCurl} from '../lib/export/curl';
import {trackEvent} from '../lib/analytics';
import {getAppVersion} from '../lib/appInfo';
import {CHECK_FOR_UPDATES_INTERVAL} from '../lib/constants';
import {getModal} from '../components/modals/index';


class App extends Component {
  constructor (props) {
    super(props);

    const workspace = this._getActiveWorkspace(props);
    this.state = {
      activeResponse: null,
      activeRequest: null,
      draggingSidebar: false,
      draggingPane: false,
      sidebarWidth: workspace.metaSidebarWidth || DEFAULT_SIDEBAR_WIDTH, // rem
      paneWidth: workspace.metaPaneWidth || DEFAULT_PANE_WIDTH // % (fr)
    };

    this.globalKeyMap = {

      // Show Settings
      'mod+,': () => {
        // NOTE: This is controlled via a global menu shortcut in app.js
        // getModal(SettingsModal).toggle();
      },

      // Show Request Switcher
      'mod+p': () => {
        getModal(RequestSwitcherModal).toggle();
      },

      // Request Send
      'mod+enter': () => {
        const request = this._getActiveRequest();
        if (request) {
          this.props.actions.requests.send(request);
        }
      },

      // Edit Workspace Environments
      'mod+e': () => {
        getModal(WorkspaceEnvironmentsEditModal).toggle(this._getActiveWorkspace());
      },

      // Edit Cookies
      'mod+k': () => {
        getModal(CookiesModal).toggle(this._getActiveWorkspace());
      },

      // Request Create
      'mod+n': () => {
        const workspace = this._getActiveWorkspace();
        const request = this._getActiveRequest();

        if (!workspace) {
          // Nothing to do if no workspace
          return;
        }

        const parentId = request ? request.parentId : workspace._id;
        this._requestCreate(parentId);
      },

      // Request Duplicate
      'mod+d': () => {
        const request = this._getActiveRequest();
        const workspace = this._getActiveWorkspace();

        if (!request) {
          return;
        }

        db.requestDuplicateAndActivate(workspace, request);
      }
    }
  }

  _importFile () {
    const workspace = this._getActiveWorkspace();
    this.props.actions.global.importFile(workspace);
  }

  _moveRequestGroup (requestGroupToMove, requestGroupToTarget, targetOffset) {
    // Oh God, this function is awful...

    if (requestGroupToMove._id === requestGroupToTarget._id) {
      // Nothing to do
      return;
    }

    // NOTE: using requestToTarget's parentId so we can switch parents!
    db.requestGroupFindByParentId(requestGroupToTarget.parentId).then(requestGroups => {
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
            console.warn('-- Recreating Sort Keys --');

            requestGroups.map((r, i) => {
              db.requestGroupUpdate(r, {
                metaSortKey: i * 100,
                parentId: requestGroupToTarget.parentId
              });
            });
          } else {
            const metaSortKey = afterKey - (afterKey - beforeKey) / 2;
            db.requestGroupUpdate(requestGroupToMove, {
              metaSortKey,
              parentId: requestGroupToTarget.parentId
            });
          }

          break;
        }
      }
    })
  }

  _moveRequest (requestToMove, parentId, targetId, targetOffset) {
    // Oh God, this function is awful...

    if (requestToMove._id === targetId) {
      // Nothing to do. We are in the same spot as we started
      return;
    }

    if (targetId === null) {
      // We are moving to an empty area. No sorting required
      db.requestUpdate(requestToMove, {parentId});
      return;
    }

    // NOTE: using requestToTarget's parentId so we can switch parents!
    db.requestFindByParentId(parentId).then(requests => {
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
            console.warn(`-- Recreating Sort Keys ${beforeKey} ${afterKey} --`);

            requests.map((r, i) => {
              db.requestUpdate(r, {metaSortKey: i * 100, parentId});
            });
          } else {
            const metaSortKey = afterKey - (afterKey - beforeKey) / 2;
            db.requestUpdate(requestToMove, {metaSortKey, parentId});
          }

          break;
        }
      }
    })
  }

  _requestGroupCreate (parentId) {
    getModal(PromptModal).show({
      headerName: 'Create New Folder',
      defaultValue: 'My Folder',
      selectText: true
    }).then(name => {
      db.requestGroupCreate({parentId, name})
    });
  }

  _requestCreate (parentId) {
    getModal(PromptModal).show({
      headerName: 'Create New Request',
      defaultValue: 'My Request',
      selectText: true
    }).then(name => {
      const workspace = this._getActiveWorkspace();
      db.requestCreateAndActivate(workspace, {parentId, name})
    });
  }

  _generateSidebarTree (parentId, entities) {
    const children = entities.filter(
      e => e.parentId === parentId
    ).sort((a, b) => {
      if (a.metaSortKey === b.metaSortKey) {
        return a._id > b._id ? -1 : 1;
      } else {
        return a.metaSortKey < b.metaSortKey ? -1 : 1;
      }
    });

    if (children.length > 0) {
      return children.map(c => ({
        doc: c,
        children: this._generateSidebarTree(c._id, entities)
      }));
    } else {
      return children;
    }
  }

  _handleUrlChanged (url) {
    // TODO: Should this be moved elsewhere?
    const requestPatch = importCurl(url);

    if (requestPatch) {
      // If the user typed in a curl cmd, dissect it and update the whole request
      db.requestUpdate(this._getActiveRequest(), requestPatch).then(() => {
        setTimeout(() => {

        })
      });
    } else {
      db.requestUpdate(this._getActiveRequest(), {url});
    }
  }

  _startDragSidebar () {
    this.setState({
      draggingSidebar: true
    })
  }

  _resetDragSidebar () {
    // TODO: Remove setTimeout need be not triggering drag on double click
    setTimeout(() => {
      this.setState({
        sidebarWidth: DEFAULT_SIDEBAR_WIDTH
      });

      this._saveSidebarWidth();
    }, 50);
  }

  _startDragPane () {
    this.setState({
      draggingPane: true
    })
  }

  _resetDragPane () {
    // TODO: Remove setTimeout need be not triggering drag on double click
    setTimeout(() => {
      this.setState({
        paneWidth: DEFAULT_PANE_WIDTH
      })

      this._savePaneWidth();
    }, 50);
  }

  _savePaneWidth () {
    const metaPaneWidth = this.state.paneWidth;
    db.workspaceUpdate(this._getActiveWorkspace(), {metaPaneWidth});
  }

  _saveSidebarWidth () {
    const metaSidebarWidth = this.state.sidebarWidth;
    db.workspaceUpdate(this._getActiveWorkspace(), {metaSidebarWidth});
  }

  _getActiveWorkspace (props) {
    // TODO: Factor this out into a selector

    const {entities, workspaces, actions} = props || this.props;
    let workspace = entities.workspaces[workspaces.activeId];
    if (!workspace) {
      workspace = entities.workspaces[Object.keys(entities.workspaces)[0]];
    }

    return workspace;
  }

  _getActiveRequest (props) {
    // TODO: Factor this out into a selector

    props = props || this.props;
    const {entities} = props;
    let activeRequestId = this._getActiveWorkspace(props).metaActiveRequestId;
    return activeRequestId ? entities.requests[activeRequestId] : null;
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
      this.setState({paneWidth});

    } else if (this.state.draggingSidebar) {
      const currentPixelWidth = ReactDOM.findDOMNode(this._sidebar).offsetWidth;
      const ratio = e.clientX / currentPixelWidth;
      const width = this.state.sidebarWidth * ratio;
      let sidebarWidth = Math.max(Math.min(width, MAX_SIDEBAR_REMS), MIN_SIDEBAR_REMS);
      this.setState({sidebarWidth})
    }
  }

  _handleMouseUp () {
    if (this.state.draggingSidebar) {
      this.setState({
        draggingSidebar: false
      });

      this._saveSidebarWidth();
    }

    if (this.state.draggingPane) {
      this.setState({
        draggingPane: false
      });

      this._savePaneWidth();
    }
  }

  componentWillReceiveProps (nextProps) {
    const sidebarWidth = this._getActiveWorkspace(nextProps).metaSidebarWidth;
    this.setState({sidebarWidth});
  }

  componentDidMount () {
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
    trackEvent('App Launched');

    // Update Stats Object
    db.statsGet().then(({lastVersion, launches}) => {
      const firstLaunch = !lastVersion;
      if (firstLaunch) {
        // TODO: Show a welcome message
      } else if (lastVersion !== getAppVersion()) {
        getModal(ChangelogModal).show();
      }

      db.statsUpdate({
        launches: launches + 1,
        lastLaunch: Date.now(),
        lastVersion: getAppVersion()
      });
    });

    setInterval(() => {
      ipcRenderer.send('check-for-updates');
    }, CHECK_FOR_UPDATES_INTERVAL);

    ipcRenderer.on('toggle-preferences', () => {
      getModal(SettingsModal).toggle();
    })
  }

  componentWillUnmount () {
    // Remove mouse handlers
    document.removeEventListener('mouseup', this._handleMouseUp);
    document.removeEventListener('mousemove', this._handleMouseMove);

    // Unbind global keyboard shortcuts
    Mousetrap.unbind();
  }

  render () {
    // throw new Error('Test Exception');
    const {actions, entities, requests} = this.props;
    const settings = entities.settings[Object.keys(entities.settings)[0]];

    const workspace = this._getActiveWorkspace();

    const activeRequest = this._getActiveRequest();
    const activeRequestId = activeRequest ? activeRequest._id : null;

    const allRequests = Object.keys(entities.requests).map(id => entities.requests[id]);
    const allRequestGroups = Object.keys(entities.requestGroups).map(id => entities.requestGroups[id]);

    const children = this._generateSidebarTree(
      workspace._id,
      allRequests.concat(allRequestGroups)
    );

    const {sidebarWidth, paneWidth} = this.state;
    const gridTemplateColumns = `${sidebarWidth}rem 0 ${paneWidth}fr 0 ${1 - paneWidth}fr`;

    return (
      <div id="wrapper" className="wrapper" style={{gridTemplateColumns: gridTemplateColumns}}>
        <Sidebar
          ref={n => this._sidebar = n}
          showEnvironmentsModal={() => getModal(WorkspaceEnvironmentsEditModal).show(workspace)}
          showCookiesModal={() => getModal(CookiesModal).show(workspace)}
          activateRequest={r => db.workspaceUpdate(workspace, {metaActiveRequestId: r._id})}
          changeFilter={metaFilter => db.workspaceUpdate(workspace, {metaFilter})}
          moveRequest={this._moveRequest.bind(this)}
          moveRequestGroup={this._moveRequestGroup.bind(this)}
          addRequestToRequestGroup={requestGroup => this._requestCreate(requestGroup._id)}
          addRequestToWorkspace={() => this._requestCreate(workspace._id)}
          toggleRequestGroup={requestGroup => db.requestGroupUpdate(requestGroup, {metaCollapsed: !requestGroup.metaCollapsed})}
          activeRequestId={activeRequest ? activeRequest._id : null}
          requestCreate={() => this._requestCreate(activeRequest ? activeRequest.parentId : workspace._id)}
          requestGroupCreate={() => this._requestGroupCreate(workspace._id)}
          filter={workspace.metaFilter || ''}
          children={children}
          width={sidebarWidth}
        />

        <div className="drag drag--sidebar">
          <div onMouseDown={e => {e.preventDefault(); this._startDragSidebar()}}
               onDoubleClick={() => this._resetDragSidebar()}>
          </div>
        </div>

        <RequestPane
          ref={n => this._requestPane = n}
          importFile={this._importFile.bind(this)}
          request={activeRequest}
          sendRequest={actions.requests.send}
          showPasswords={settings.showPasswords}
          useBulkHeaderEditor={settings.useBulkHeaderEditor}
          editorFontSize={settings.editorFontSize}
          editorLineWrapping={settings.editorLineWrapping}
          requestCreate={() => db.requestCreateAndActivate(workspace, {parentId: workspace._id})}
          updateRequestBody={body => db.requestUpdate(activeRequest, {body})}
          updateRequestUrl={url => this._handleUrlChanged(url)}
          updateRequestMethod={method => db.requestUpdate(activeRequest, {method})}
          updateRequestParameters={parameters => db.requestUpdate(activeRequest, {parameters})}
          updateRequestAuthentication={authentication => db.requestUpdate(activeRequest, {authentication})}
          updateRequestHeaders={headers => db.requestUpdate(activeRequest, {headers})}
          updateRequestContentType={contentType => db.requestUpdateContentType(activeRequest, contentType)}
          updateSettingsShowPasswords={showPasswords => db.settingsUpdate(settings, {showPasswords})}
          updateSettingsUseBulkHeaderEditor={useBulkHeaderEditor => db.settingsUpdate(settings, {useBulkHeaderEditor})}
        />

        <div className="drag drag--pane">
          <div onMouseDown={() => this._startDragPane()}
               onDoubleClick={() => this._resetDragPane()}></div>
        </div>

        <ResponsePane
          ref={n => this._responsePane = n}
          request={activeRequest}
          editorFontSize={settings.editorFontSize}
          editorLineWrapping={settings.editorLineWrapping}
          previewMode={activeRequest ? activeRequest.metaPreviewMode : PREVIEW_MODE_FRIENDLY}
          responseFilter={activeRequest ? activeRequest.metaResponseFilter : ''}
          updatePreviewMode={metaPreviewMode => db.requestUpdate(activeRequest, {metaPreviewMode})}
          updateResponseFilter={metaResponseFilter => db.requestUpdate(activeRequest, {metaResponseFilter})}
          loadingRequests={requests.loadingRequests}
          showCookiesModal={() => getModal(CookiesModal).show(workspace)}
        />

        <PromptModal ref={m => addModal(m)}/>
        <AlertModal ref={m => addModal(m)}/>
        <ChangelogModal ref={m => addModal(m)}/>
        <SettingsModal ref={m => addModal(m)}/>
        <GenerateCodeModal ref={m => addModal(m)}/>
        <RequestSwitcherModal
          ref={m => addModal(m)}
          workspaceId={workspace._id}
          activeRequestParentId={activeRequest ? activeRequest.parentId : workspace._id}
          activateRequest={r => db.workspaceUpdate(workspace, {metaActiveRequestId: r._id})}
        />
        <EnvironmentEditModal
          ref={m => addModal(m)}
          onChange={rg => db.requestGroupUpdate(rg)}/>
        <WorkspaceEnvironmentsEditModal
          ref={m => addModal(m)}
          onChange={w => db.workspaceUpdate(w)}/>
        <CookiesModal
          ref={m => addModal(m)}
          onChange={() => console.log('TODO: COOKIES!!!')}/>

        {/*<div className="toast toast--show">*/}
        {/*<div className="toast__message">How's it going?</div>*/}
        {/*<button className="toast__action">Great!</button>*/}
        {/*<button className="toast__action">Horrible :(</button>*/}
        {/*</div>*/}
      </div>
    )
  }
}

App.propTypes = {
  actions: PropTypes.shape({
    requests: PropTypes.shape({
      send: PropTypes.func.isRequired
    }).isRequired,
    global: PropTypes.shape({
      importFile: PropTypes.func.isRequired
    }).isRequired
  }).isRequired,
  entities: PropTypes.shape({
    requests: PropTypes.object.isRequired,
    requestGroups: PropTypes.object.isRequired,
    responses: PropTypes.object.isRequired
  }).isRequired,
  workspaces: PropTypes.shape({
    activeId: PropTypes.string
  }).isRequired,
  requests: PropTypes.shape({
    loadingRequests: PropTypes.object.isRequired
  }).isRequired
};

function mapStateToProps (state) {
  return {
    actions: state.actions,
    workspaces: state.workspaces,
    requests: state.requests,
    entities: state.entities
  };
}

function mapDispatchToProps (dispatch) {
  return {
    actions: {
      global: bindActionCreators(GlobalActions, dispatch),
      requests: bindActionCreators(RequestActions, dispatch)
    }
  }
}

const reduxApp = connect(
  mapStateToProps,
  mapDispatchToProps
)(App);

export default DragDropContext(HTML5Backend)(reduxApp);

