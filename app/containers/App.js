import React, { Component, PropTypes } from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import Editor from '../components/Editor';
import Header from '../components/Header'
import * as TodoActions from '../actions'

class App extends Component {
  render () {
    //const { global, todos, actions } = this.props;
    return (
      <div className="grid">
        <aside id="sidebar" className="pane">
          <header className="header header-clickable">
            <h1><a href="#">Insomnia</a></h1>
          </header>
          <ul className="sidebar-items">
            {[0, 1, 2, 3, 4].map((i) => {
              return <li key={i} className={'item ' + (i === 0 ? 'active': '')}>
                <a href="#">Item 1</a>
              </li>;
            })}
          </ul>
        </aside>
        <section id="request" className="pane col grid-v">
          <header className="header header-no-padding">
            <div className="form-control url-input">
              <div className="grid">
                <button className="btn bg-light bg-hover method-dropdown">
                  POST&nbsp;&nbsp;<i className="fa fa-caret-down"></i>
                </button>
                <input type="text" placeholder="https://google.com"/>
                <button className="btn bg-hover bg-light send-request-button">
                  <i className="fa fa-play-circle-o txt-xl"></i>
                </button>
              </div>
            </div>
          </header>
          <Editor value={localStorage['json']}
                  onChange={(v) => {localStorage['json'] = v;}}
                  options={{mode: 'application/json', lineNumbers: true}}
          ></Editor>
        </section>
        <section id="response" className="pane col grid-v">
          <header className="header"><h2>Response</h2></header>
          <Editor value={localStorage['json']}
                  onChange={(v) => {localStorage['json'] = v;}}
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
