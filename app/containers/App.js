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

  render () {
    const {actions, modals, workspaces} = this.props;
    const {requests, requestGroups, responses} = workspaces;

    const activeRequest = requests.active;
    const activeResponse = activeRequest ? responses[activeRequest._id] : undefined;

    return (
      <div className="grid bg-super-dark tall">
        <Sidebar
          workspaceId={workspaces.active._id}
          activateRequest={db.requestActivate}
          changeFilter={actions.requests.changeFilter}
          addRequestToRequestGroup={requestGroup => db.requestCreate({parentId: requestGroup._id})}
          toggleRequestGroup={requestGroup => db.update(requestGroup, {collapsed: !requestGroup.collapsed})}
          activeRequestId={activeRequest._id}
          filter={requests.filter}
          requestGroups={requestGroups.all.sort((a, b) => a._id > b._id ? -1 : 1)}
          requests={requests.all.sort((a, b) => a._id > b._id ? -1 : 1)}
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
  workspaces: PropTypes.shape({
    active: PropTypes.object,
    responses: PropTypes.object.isRequired,
    requestGroups: PropTypes.shape({
      all: PropTypes.array.isRequired
    }).isRequired,
    requests: PropTypes.shape({
      all: PropTypes.array.isRequired,
      active: PropTypes.object
    }).isRequired
  }).isRequired,
  modals: PropTypes.array.isRequired
};

function mapStateToProps (state) {
  return {
    actions: state.actions,
    workspaces: state.workspaces,
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

