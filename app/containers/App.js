import React, {Component, PropTypes} from 'react'
import ReactDOM from 'react-dom'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {HotKeys} from 'react-hotkeys'

import Prompts from './Prompts'
import EnvironmentEditModal from '../components/EnvironmentEditModal'
import SettingsModal from '../components/SettingsModal'
import RequestSwitcherModal from '../components/RequestSwitcherModal'
import RequestPane from '../components/RequestPane'
import ResponsePane from '../components/ResponsePane'
import Sidebar from '../components/Sidebar'
import {PREVIEW_MODE_FRIENDLY} from '../lib/previewModes'
import {MAX_PANE_WIDTH, MIN_PANE_WIDTH, MAX_SIDEBAR_REMS, MIN_SIDEBAR_REMS} from '../lib/constants'

import * as GlobalActions from '../redux/modules/global'
import * as RequestGroupActions from '../redux/modules/requestGroups'
import * as RequestActions from '../redux/modules/requests'

import * as db from '../database'

const keyMap = {
  showRequestSwitcher: 'mod+k',
  showSettingsModal: 'mod+,',
  escape: 'esc'
};

class App extends Component {
  constructor (props) {
    super(props);
    this.state = {
      activeResponse: null,
      activeRequest: null,
      draggingSidebar: false,
      draggingPane: false,
      paneWidth: 0.5, // % (fr)
      sidebarWidth: 19 // rem
    };
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

  _startDragSidebar () {
    console.log('-- Start Sidebar Drag --');

    this.setState({
      draggingSidebar: true
    })
  }

  _startDragPane () {
    console.log('-- Start Pane Drag --');

    this.setState({
      draggingPane: true
    })
  }

  componentDidMount () {
    document.addEventListener('mouseup', () => {
      if (this.state.draggingSidebar || this.state.draggingPane) {
        console.log('-- End Pane or Sidebar Drag --');

        this.setState({
          draggingSidebar: false,
          draggingPane: false
        })
      }
    });

    document.addEventListener('mousemove', e => {
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
    })
  }

  componentWillUnmount () {
    console.log('hello');
  }

  render () {
    const {actions, workspaces, requests, entities} = this.props;

    // TODO: Factor this out into a selector
    let workspace = entities.workspaces[workspaces.activeId];
    if (!workspace) {
      workspace = entities.workspaces[Object.keys(entities.workspaces)[0]];
    }

    let activeRequestId = workspace.activeRequestId;
    const activeRequest = activeRequestId ? entities.requests[activeRequestId] : null;

    // Request doesn't actually exist anymore :(
    if (!activeRequest) {
      activeRequestId = null;
    }

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

    const handlers = {
      showRequestSwitcher: () => {
        this.refs.requestSwitcherModal.show();
        console.log('-- Show Request Switcher --');
      },
      showSettingsModal: () => {
        this.refs.settingsModal.show();
        console.log('-- Show Settings Modal --');
      }
    };

    return (
      <HotKeys
        style={{gridTemplateColumns: gridTemplateColumns}}
        keyMap={keyMap}
        handlers={handlers}
        focus={true}
        focused={true}
        className="wrapper"
        id="wrapper">

        <Sidebar
          ref="sidebar"
          workspaceId={workspace._id}
          activateRequest={r => db.workspaceUpdate(workspace, {activeRequestId: r._id})}
          changeFilter={actions.requests.changeFilter}
          addRequestToRequestGroup={requestGroup => db.requestCreate({parentId: requestGroup._id})}
          toggleRequestGroup={requestGroup => db.requestGroupUpdate(requestGroup, {collapsed: !requestGroup.collapsed})}
          activeRequestId={activeRequest ? activeRequest._id : null}
          filter={requests.filter}
          children={children}
        />

        <div className="drag drag--sidebar">
          <div onMouseDown={e => this._startDragSidebar(e)}></div>
        </div>

        <RequestPane
          ref="requestPane"
          request={activeRequest}
          sendRequest={actions.requests.send}
          updateRequestBody={body => db.requestUpdate(activeRequest, {body})}
          updateRequestUrl={url => db.requestUpdate(activeRequest, {url})}
          updateRequestMethod={method => db.requestUpdate(activeRequest, {method})}
          updateRequestParams={params => db.requestUpdate(activeRequest, {params})}
          updateRequestAuthentication={authentication => db.requestUpdate(activeRequest, {authentication})}
          updateRequestHeaders={headers => db.requestUpdate(activeRequest, {headers})}
          updateRequestContentType={contentType => db.requestUpdate(activeRequest, {contentType})}
        />

        <div className="drag drag--pane">
          <div onMouseDown={e => this._startDragPane(e)}></div>
        </div>

        <ResponsePane
          ref="responsePane"
          response={activeResponse}
          previewMode={activeRequest ? activeRequest.previewMode : PREVIEW_MODE_FRIENDLY}
          updatePreviewMode={previewMode => db.requestUpdate(activeRequest, {previewMode})}
        />

        <Prompts />

        <SettingsModal ref="settingsModal"/>
        <RequestSwitcherModal ref="requestSwitcherModal" />
      </HotKeys>
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
    filter: PropTypes.string.isRequired
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
      global: bindActionCreators(GlobalActions, dispatch),
      requestGroups: bindActionCreators(RequestGroupActions, dispatch),
      requests: bindActionCreators(RequestActions, dispatch)
    }
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(App);

