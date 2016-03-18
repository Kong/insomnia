import React, { Component, PropTypes } from 'react'
import { connect } from 'react-redux'
import Sidebar from '../components/Sidebar'
import RequestPane from '../components/RequestPane'
import ResponsePane from '../components/ResponsePane'

class App extends Component {
  render () {
    //const { global, todos, actions } = this.props;
    return (
      <div className="grid bg-dark">
        <Sidebar />
        <RequestPane />
        <ResponsePane />
      </div>
    )
  };
}

App.propTypes = {
  //todos: PropTypes.array.isRequired,
  //global: PropTypes.object.isRequired,
  //actions: PropTypes.object.isRequired
};

function mapStateToProps (state) {
  return {
    //todos: state.todos,
    //global: state.global
  }
}

function mapDispatchToProps (dispatch) {
  return {
    //actions: bindActionCreators(TodoActions, dispatch)
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(App)
