import React, {Component, PropTypes} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import Sidebar from '../components/Sidebar'
import RequestPane from '../components/RequestPane'
import ResponsePane from '../components/ResponsePane'

import * as RequestActions from '../actions/requests'
import * as GlobalActions from '../actions/global'

class App extends Component {
  componentDidMount () {
    const {actions} = this.props;
    actions.restoreState();
  }

  renderRequestPane () {
    const {actions, activeRequest} = this.props;
    return (
      <RequestPane
        updateRequestBody={actions.updateRequestBody.bind(null, activeRequest.id)}
        updateRequestUrl={actions.updateRequestUrl.bind(null, activeRequest.id)}
        request={activeRequest}
      />
    )
  }

  renderResponsePane () {
    const {activeRequest} = this.props;
    return (
      <ResponsePane request={activeRequest}/>
    )
  }

  render () {
    const {actions, loading, activeRequest, allRequests} = this.props;
    return (
      <div className="grid bg-dark">
        <Sidebar
          activateRequest={actions.activateRequest}
          addRequest={actions.addRequest}
          loading={loading}
          activeRequest={activeRequest}
          requests={allRequests}
        />
        {activeRequest ? this.renderRequestPane() : <div></div>}
        {activeRequest ? this.renderResponsePane() : <div></div>}
      </div>
    )
  }
}

App.propTypes = {
  allRequests: PropTypes.array.isRequired,
  activeRequest: PropTypes.object,
  loading: PropTypes.bool.isRequired
};

function mapStateToProps (state) {
  return {
    actions: state.actions,
    allRequests: state.requests.all,
    activeRequest: state.requests.all.find(r => r.id === state.requests.activeId),
    loading: state.loading
  };
}

function mapDispatchToProps (dispatch) {
  return {
    actions: Object.assign(
      {},
      bindActionCreators(GlobalActions, dispatch),
      bindActionCreators(RequestActions, dispatch)
    )
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(App);

