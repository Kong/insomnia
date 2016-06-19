import React, {Component, PropTypes} from 'react'
import ReactDOM from 'react-dom'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import Prompts from './Prompts'
import EnvironmentEditModal from '../components/EnvironmentEditModal'
import SettingsModal from '../components/SettingsModal'
import RequestPane from '../components/RequestPane'
import ResponsePane from '../components/ResponsePane'
import Sidebar from '../components/Sidebar'
import {PREVIEW_MODE_FRIENDLY} from '../lib/previewModes'

import * as GlobalActions from '../redux/modules/global'
import * as RequestGroupActions from '../redux/modules/requestGroups'
import * as RequestActions from '../redux/modules/requests'
import * as ModalActions from '../redux/modules/modals'

import * as db from '../database'

class App extends Component {
  constructor (props) {
    super(props);
    this.state = {
      activeResponse: null,
      activeRequest: null,
      draggingSidebar: false,
      draggingPane: false,
      paneWidth: 0.5
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

  _startDragSidebar () {
    this.setState({
      draggingSidebar: true
    })
  }

  _startDragPane () {
    this.setState({
      draggingPane: true
    })
  }

  componentDidMount () {
    document.addEventListener('mouseup', e => {
      this.setState({
        draggingSidebar: false,
        draggingPane: false
      })
    });

    document.addEventListener('mousemove', e => {
      if (this.state.draggingPane) {
        const requestPane = ReactDOM.findDOMNode(this.refs.requestPane);
        const responsePane = ReactDOM.findDOMNode(this.refs.responsePane);

        const requestPaneWidth = requestPane.offsetWidth;
        const responsePaneWidth = responsePane.offsetWidth;
        const pixelOffset = e.clientX - requestPane.offsetLeft;
        const ratio = pixelOffset / (requestPaneWidth + responsePaneWidth);
        const paneWidth = Math.max(Math.min(ratio, 0.6), 0.4);
        
        this.setState({paneWidth});
      } else if (this.state.draggingSidebar) {
        this.refs.sidebar.resize(e.clientX);
      }
    })
  }

  componentWillUnmount () {
    console.log('hello');
  }

  render () {
    const {actions, modals, workspaces, requests, entities} = this.props;

    // TODO: Factor this out into a selector
    let workspace = entities.workspaces[workspaces.activeId];
    if (!workspace) {
      workspace = entities.workspaces[Object.keys(entities.workspaces)[0]];
    }

    const activeRequestId = workspace.activeRequestId;
    const activeRequest = activeRequestId ? entities.requests[activeRequestId] : null;

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

    return (
      <div className="wrapper"
           style={{gridTemplateColumns: `auto 0 ${this.state.paneWidth}fr 0 ${1 - this.state.paneWidth}fr`}}>
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

        {modals.map(m => {
          if (m.id === SettingsModal.defaultProps.id) {
            return (
              <SettingsModal
                key={m.id}
                onClose={() => actions.modals.hide(m.id)}
              />
            )
          } else if (m.id === EnvironmentEditModal.defaultProps.id) {
            return (
              <EnvironmentEditModal
                key={m.id}
                requestGroup={m.data.requestGroup}
                onClose={() => actions.modals.hide(m.id)}
                onChange={rg => db.requestGroupUpdate(m.data.requestGroup, {environment: rg.environment})}
              />
            )
          } else {
            return null;
          }
        })}
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
      modals: bindActionCreators(ModalActions, dispatch),
      requestGroups: bindActionCreators(RequestGroupActions, dispatch),
      requests: bindActionCreators(RequestActions, dispatch)
    }
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(App);

