import React, {Component, PropTypes} from 'react';
import ReactDOM from 'react-dom';
import classnames from 'classnames';
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux';
import Mousetrap from '../lib/mousetrap';

import EnvironmentEditModal from '../components/EnvironmentEditModal';
import RequestSwitcherModal from '../components/RequestSwitcherModal';
import CurlExportModal from '../components/CurlExportModal';
import PromptModal from '../components/PromptModal';
import SettingsModal from '../components/SettingsModal';
import RequestPane from '../components/RequestPane';
import ResponsePane from '../components/ResponsePane';
import Sidebar from '../components/Sidebar';
import {PREVIEW_MODE_FRIENDLY} from '../lib/previewModes';
import {
  MAX_PANE_WIDTH, MIN_PANE_WIDTH,
  DEFAULT_PANE_WIDTH,
  MAX_SIDEBAR_REMS,
  MIN_SIDEBAR_REMS,
  DEFAULT_SIDEBAR_WIDTH
} from '../lib/constants'

import * as RequestGroupActions from '../redux/modules/requestGroups';
import * as RequestActions from '../redux/modules/requests';

import * as db from '../database';
import {importCurl} from "../lib/export/curl";

class App extends Component {
  constructor (props) {
    super(props);

    const workspace = this._getActiveWorkspace(props);
    this.state = {
      activeResponse: null,
      activeRequest: null,
      draggingSidebar: false,
      draggingPane: false,
      sidebarWidth: workspace.meta.sidebarWidth || DEFAULT_SIDEBAR_WIDTH, // rem
      paneWidth: workspace.meta.paneWidth || DEFAULT_PANE_WIDTH // % (fr)
    };

    this.globalKeyMap = {

      // Show Settings
      'mod+,': () => {
        SettingsModal.toggle();
      },

      // Show Environment Editor
      'mod+e': () => {
        this._fetchActiveRequestGroup().then(requestGroup => {
          EnvironmentEditModal.toggle(requestGroup);
        }, () => {
          // No RequestGroup is active
        })
      },

      // Show Request Switcher
      'mod+k|mod+p': () => {
        RequestSwitcherModal.toggle();
      },

      // Request Send
      'mod+enter|mod+r': () => {
        const request = this._getActiveRequest();
        if (request) {
          this.props.actions.requests.send(request);
        }
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
        db.requestCreateAndActivate(workspace, {parentId});
      },

      // Request Duplicate
      'mod+d': () => {
        const request = this._getActiveRequest();

        if (!request) {
          return;
        }

        db.requestCopyAndActivate(workspace, request);
      },

      // Change Http Method
      'mod+m': () => {
        // TODO: This
      },

      // Sidebar Toggle
      'mod+\\': () => {
        // TODO: This
      }
    }
  }

  _generateSidebarTree (parentId, entities) {
    const children = entities.filter(e => e.parentId === parentId);

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
      db.requestUpdate(this._getActiveRequest(), requestPatch);
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
      })

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
    const {paneWidth} = this.state;
    db.workspaceUpdateMeta(this._getActiveWorkspace(), {paneWidth});
  }

  _saveSidebarWidth () {
    const {sidebarWidth} = this.state;
    db.workspaceUpdateMeta(this._getActiveWorkspace(), {sidebarWidth});
  }

  _getActiveWorkspace (props) {
    // TODO: Factor this out into a selector

    const {entities, workspaces} = props || this.props;
    let workspace = entities.workspaces[workspaces.activeId];
    if (!workspace) {
      workspace = entities.workspaces[Object.keys(entities.workspaces)[0]];
    }

    return workspace;
  }

  _getActiveRequest (props) {
    props = props || this.props;
    const {entities} = props;
    let activeRequestId = this._getActiveWorkspace(props).meta.activeRequestId;
    return activeRequestId ? entities.requests[activeRequestId] : null;
  }

  _fetchActiveRequestGroup (props) {
    return new Promise((resolve, reject) => {
      props = props || this.props;
      const request = this._getActiveRequest(props);

      if (!request) {
        reject();
      }

      db.requestGroupById(request.parentId).then(requestGroup => {
        if (requestGroup) {
          resolve(requestGroup);
        } else {
          reject();
        }
      });
    });
  }

  _handleMouseMove (e) {
    if (this.state.draggingPane) {
      const requestPane = ReactDOM.findDOMNode(this.refs.requestPane);
      const responsePane = ReactDOM.findDOMNode(this.refs.responsePane);

      const requestPaneWidth = requestPane.offsetWidth;
      const responsePaneWidth = responsePane.offsetWidth;
      const pixelOffset = e.clientX - requestPane.offsetLeft;
      let paneWidth = pixelOffset / (requestPaneWidth + responsePaneWidth);
      paneWidth = Math.min(Math.max(paneWidth, MIN_PANE_WIDTH), MAX_PANE_WIDTH);
      this.setState({paneWidth});

    } else if (this.state.draggingSidebar) {
      const currentPixelWidth = ReactDOM.findDOMNode(this.refs.sidebar).offsetWidth;
      const ratio = e.clientX / currentPixelWidth;
      const width = this.state.sidebarWidth * ratio;
      const sidebarWidth = Math.max(Math.min(width, MAX_SIDEBAR_REMS), MIN_SIDEBAR_REMS);
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
    const sidebarWidth = this._getActiveWorkspace(nextProps).meta.sidebarWidth;
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
  }

  componentWillUnmount () {
    // Remove mouse handlers
    document.removeEventListener('mouseup', this._handleMouseUp);
    document.removeEventListener('mousemove', this._handleMouseMove);

    // Unbind global keyboard shortcuts
    Mousetrap.unbind();
  }

  render () {
    const {actions, entities, requests} = this.props;

    const workspace = this._getActiveWorkspace();

    const activeRequest = this._getActiveRequest();
    const activeRequestId = activeRequest ? activeRequest._id : null;

    const responses = Object.keys(entities.responses).map(id => entities.responses[id]);
    const allRequests = Object.keys(entities.requests).map(id => entities.requests[id]);
    const allRequestGroups = Object.keys(entities.requestGroups).map(id => entities.requestGroups[id]);

    const activeResponse = responses.sort(
      (a, b) => a._id > b._id ? -1 : 1
    ).find(r => r.parentId === activeRequestId);

    const children = this._generateSidebarTree(
      workspace._id,
      allRequests.concat(allRequestGroups)
    );

    const {sidebarWidth, paneWidth} = this.state;
    const gridTemplateColumns = `${sidebarWidth}rem 0 ${paneWidth}fr 0 ${1 - paneWidth}fr`;

    const classes = classnames('wrapper', {'wrapper--sidebar-hidden': !workspace.meta.sidebarVisible});
    return (
      <div id="wrapper" className={classes} style={{gridTemplateColumns: gridTemplateColumns}}>
        <Sidebar
          ref="sidebar"
          activateRequest={r => db.workspaceUpdateMeta(workspace, {activeRequestId: r._id})}
          changeFilter={filter => db.workspaceUpdate(workspace, {filter})}
          addRequestToRequestGroup={requestGroup => db.requestCreate({parentId: requestGroup._id})}
          toggleRequestGroup={requestGroup => db.requestGroupUpdateMeta(requestGroup, {collapsed: !requestGroup.meta.collapsed})}
          activeRequestId={activeRequest ? activeRequest._id : null}
          filter={workspace.filter || ''}
          children={children}
        />

        <div className="drag drag--sidebar">
          <div onMouseDown={() => this._startDragSidebar()}
               onDoubleClick={() => this._resetDragSidebar()}>
          </div>
        </div>

        <RequestPane
          ref="requestPane"
          request={activeRequest}
          sendRequest={actions.requests.send}
          updateRequestBody={body => db.requestUpdate(activeRequest, {body})}
          updateRequestUrl={url => this._handleUrlChanged(url)}
          updateRequestMethod={method => db.requestUpdate(activeRequest, {method})}
          updateRequestParameters={parameters => db.requestUpdate(activeRequest, {parameters})}
          updateRequestAuthentication={authentication => db.requestUpdate(activeRequest, {authentication})}
          updateRequestHeaders={headers => db.requestUpdate(activeRequest, {headers})}
          updateRequestContentType={contentType => db.requestUpdate(activeRequest, {contentType})}
        />

        <div className="drag drag--pane">
          <div onMouseDown={() => this._startDragPane()}
               onDoubleClick={() => this._resetDragPane()}></div>
        </div>

        <ResponsePane
          ref="responsePane"
          response={activeResponse}
          request={activeRequest}
          previewMode={activeRequest ? activeRequest.meta.previewMode : PREVIEW_MODE_FRIENDLY}
          updatePreviewMode={previewMode => db.requestUpdateMeta(activeRequest, {previewMode})}
          loadingRequests={requests.loadingRequests}
        />

        <PromptModal />
        <SettingsModal />
        <RequestSwitcherModal />
        <CurlExportModal />
        <EnvironmentEditModal onChange={rg => db.requestGroupUpdate(rg)}/>
      </div>
    )
  }
}

App.propTypes = {
  actions: PropTypes.shape({
    requests: PropTypes.shape({
      send: PropTypes.func.isRequired,
      changeFilter: PropTypes.func.isRequired
    }),
    requestGroups: PropTypes.shape({
      toggle: PropTypes.func.isRequired
    }),
    modals: PropTypes.shape({
      hide: PropTypes.func.isRequired
    })
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
    filter: PropTypes.string.isRequired,
    loadingRequests: PropTypes.object.isRequired
  }).isRequired,
  modals: PropTypes.array.isRequired
};

function mapStateToProps (state) {
  return {
    actions: state.actions,
    workspaces: state.workspaces,
    requests: state.requests,
    entities: state.entities,
    modals: state.modals
  };
}

function mapDispatchToProps (dispatch) {
  return {
    actions: {
      requestGroups: bindActionCreators(RequestGroupActions, dispatch),
      requests: bindActionCreators(RequestActions, dispatch)
    }
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(App);

