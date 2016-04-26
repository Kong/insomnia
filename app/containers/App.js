import React, {Component, PropTypes} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import Prompts from './Prompts'
import EnvironmentEditModal from '../components/EnvironmentEditModal'
import RequestPane from '../components/RequestPane'
import ResponsePane from '../components/ResponsePane'
import Sidebar from '../components/Sidebar'

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
      activeRequest: null
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
      <div className="grid bg-super-dark tall">
        <Sidebar
          workspaceId={workspace._id}
          activateRequest={r => db.update(workspace, {activeRequestId: r._id})}
          changeFilter={actions.requests.changeFilter}
          addRequestToRequestGroup={requestGroup => db.requestCreate({parentId: requestGroup._id})}
          toggleRequestGroup={requestGroup => db.update(requestGroup, {collapsed: !requestGroup.collapsed})}
          activeRequestId={activeRequest ? activeRequest._id : null}
          filter={requests.filter}
          children={children}
        />
        <div className="grid wide grid--collapse">
          <RequestPane
            request={activeRequest}
            sendRequest={actions.requests.send}
            updateRequestBody={body => db.update(activeRequest, {body})}
            updateRequestUrl={url => db.update(activeRequest, {url})}
            updateRequestMethod={method => db.update(activeRequest, {method})}
            updateRequestParams={params => db.update(activeRequest, {params})}
            updateRequestAuthentication={authentication => db.update(activeRequest, {authentication})}
            updateRequestHeaders={headers => db.update(activeRequest, {headers})}
          />
          <ResponsePane
            response={activeResponse}
          />
        </div>

        <Prompts />

        {modals.map(m => {
          if (m.id === EnvironmentEditModal.defaultProps.id) {
            return (
              <EnvironmentEditModal
                key={m.id}
                requestGroup={m.data.requestGroup}
                onClose={() => actions.modals.hide(m.id)}
                onChange={rg => db.update(m.data.requestGroup, {environment: rg.environment})}
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

