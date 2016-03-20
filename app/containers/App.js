import React, {Component, PropTypes} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import Sidebar from '../components/Sidebar'
import RequestPane from '../components/RequestPane'
import ResponsePane from '../components/ResponsePane'

import * as RequestActions from '../actions/requests'
import * as GlobalActions from '../actions/global'

class App extends Component {
  componentDidMount() {
    const {actions} = this.props;
    actions.restoreState();
  }
  renderEditor () {
    const {actions, requests} = this.props;
    return (
      <div className="grid">
        <RequestPane
          updateRequest={actions.updateRequest}
          request={requests.active}/>
        <ResponsePane request={requests.active}/>
      </div>
    )
  }

  render () {
    const {actions, loading, requests} = this.props;
    return (
      <div className="grid bg-dark">
        <Sidebar
          activateRequest={actions.activateRequest}
          addRequest={actions.addRequest}
          loading={loading}
          requests={requests}/>
        {requests.active ? this.renderEditor() : <div></div>}
      </div>
    )
  }
}

App.propTypes = {
  requests: PropTypes.object.isRequired,
  loading: PropTypes.bool.isRequired
};

function mapStateToProps (state) {
  return {
    actions: state.actions,
    requests: state.requests,
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

