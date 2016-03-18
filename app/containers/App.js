import React, { Component, PropTypes } from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import Editor from '../components/Editor'
import Sidebar from '../components/Sidebar'
import RequestPane from '../components/RequestPane'
import * as TodoActions from '../actions'

class App extends Component {
  render () {
    //const { global, todos, actions } = this.props;
    return (
      <div className="grid">
        <Sidebar />
        <RequestPane />
        <section id="response" className="pane col grid-v">
          <header className="header header-no-padding text-center">
            <div>
              <div className="tag success"><strong>200</strong> SUCCESS</div>
              <div className="tag"><strong>GET</strong> https://google.com</div>
            </div>
          </header>
          <Editor value={'{}'}
                  options={{mode: 'application/json', lineNumbers: true}}
          ></Editor>
        </section>
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
