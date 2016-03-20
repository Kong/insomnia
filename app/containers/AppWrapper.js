import React, {Component, PropTypes} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import App from '../components/App.js';

import * as RequestActions from '../actions/requests'
import * as GlobalActions from '../actions/global'

class AppWrapper extends Component {
  componentDidMount() {
    this.props.actions.restoreState();
  }
  render() {
    const {actions, requests, loading, initialized} = this.props;
    if (!initialized) {
      return <div>Loading...</div>
    } else {
      return <App
        addRequest={actions.addRequest}
        updateRequest={actions.updateRequest}
        requests={requests}
        loading={loading}/>
    }
  }
}

function mapStateToProps (state) {
  return state;
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
)(AppWrapper);

