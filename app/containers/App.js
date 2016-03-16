import React, { Component, PropTypes } from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import Header from '../components/Header'
import * as TodoActions from '../actions'

class App extends Component {
  render () {
    //const { global, todos, actions } = this.props;
    return (
      <div className="grid">
        <aside id="sidebar">
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
        <section id="request" className="pane col-1">
          <header className="header"><h2>Request</h2></header>
          <div className="form-control url-input grid">
            <button className="btn bg-light bg-hover txt-sm">
              POST&nbsp;&nbsp;<i className="fa fa-caret-down"></i>
            </button>
            <input type="text" placeholder="https://google.com"/>
            <button className="btn bg-hover bg-light"><i className="fa fa-play-circle-o"></i></button>
          </div>
        </section>
        <section id="response" className="pane col-1">
          <header className="header"><h2>Response</h2></header>
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
