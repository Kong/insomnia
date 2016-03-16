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
            <h2><a href="#">Insomnia</a></h2>
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
                <button className="btn bg-super-light method-dropdown">
                  POST&nbsp;&nbsp;<i className="fa fa-caret-down"></i>
                </button>
                <input type="text" placeholder="https://google.com"/>
                <button className="btn bg-super-light send-request-button">
                  <i className="fa fa-repeat txt-xl"></i>
                </button>
              </div>
            </div>
          </header>
          <div className="bg-light pane-tabs">
            {['Query Params', 'Body', 'Headers', 'Basic Auth'].map((name => {
              return <button className={'btn ' + (name === 'Body' ? 'bg-dark' : 'bg-light')}>
                {name}
              </button>
            }))}
          </div>
          <Editor value={localStorage['json']}
                  onChange={(v) => {localStorage['json'] = v;}}
                  options={{mode: 'application/json', lineNumbers: true}}
          ></Editor>
        </section>
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
