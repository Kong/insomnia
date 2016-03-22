import React, {Component, PropTypes} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';

import CodeEditor from '../components/base/Editor'
import RequestBodyEditor from '../components/RequestBodyEditor'
import RequestUrlBar from '../components/RequestUrlBar'
import Sidebar from '../components/Sidebar'

import * as RequestActions from '../actions/requests'
import * as GlobalActions from '../actions/global'

// Don't inject component styles (use our own)
Tabs.setUseDefaultStyles(false);

class App extends Component {
  renderPageBody (actions, activeRequest) {

    if (!activeRequest) {
      return <div></div>;
    }

    const updateRequestBody = actions.updateRequestBody.bind(null, activeRequest.id);
    const updateRequestUrl = actions.updateRequestUrl.bind(null, activeRequest.id);
    const updateRequestMethod = actions.updateRequestMethod.bind(null, activeRequest.id);

    return (
      <div className="grid grid-collapse">
        <section id="request" className="pane col grid-v">
          <header className="pane__header bg-super-light">
            <RequestUrlBar
              onUrlChange={updateRequestUrl}
              onMethodChange={updateRequestMethod}
              request={activeRequest}/>
          </header>
          <div className="pane__body grid-v">
            <Tabs selectedIndex={0} className="grid-v">
              <TabList className="grid">
                <Tab><button className="btn">Body</button></Tab>
                <Tab><button className="btn">Params</button></Tab>
                <Tab><button className="btn">Auth</button></Tab>
                <Tab><button className="btn">Headers</button></Tab>
              </TabList>
              <TabPanel className="grid-v">
                <RequestBodyEditor
                  className="grid-v"
                  onChange={updateRequestBody}
                  request={activeRequest}
                  options={{mode: activeRequest._mode}}/>
              </TabPanel>
              <TabPanel className="grid-v">Params</TabPanel>
              <TabPanel className="grid-v">Basic Auth</TabPanel>
              <TabPanel className="grid-v">Headers</TabPanel>
            </Tabs>
          </div>
        </section>
        <section id="response" className="pane col grid-v">
          <header className="pane__header text-center bg-light">
            <div className="pane__header__content">
              <div className="tag success"><strong>200</strong>&nbsp;SUCCESS</div>
              <div className="tag"><strong>GET</strong>&nbsp;https://google.com</div>
            </div>
          </header>
          <div className="pane__body grid-v">
            <CodeEditor
              className="grid-v"
              value="{}"
              options={{mode: 'application/json', readOnly: true}}/>
          </div>
        </section>
      </div>
    )
  }

  render () {
    const {actions, loading, requests} = this.props;
    const activeRequest = requests.all.find(r => r.id === requests.active);

    return (
      <div className="grid bg-dark">
        <Sidebar
          activateRequest={actions.activateRequest}
          addRequest={actions.addRequest}
          activeRequest={activeRequest}
          loading={loading}
          requests={requests.all}/>
        <div className="col">
          {this.renderPageBody(actions, activeRequest)}
        </div>
      </div>
    )
  }
}

App.propTypes = {
  actions: PropTypes.shape({
    activateRequest: PropTypes.func.isRequired,
    updateRequestBody: PropTypes.func.isRequired,
    updateRequestUrl: PropTypes.func.isRequired,
    updateRequestMethod: PropTypes.func.isRequired
  }).isRequired,
  requests: PropTypes.shape({
    all: PropTypes.array.isRequired,
    active: PropTypes.string // "required" but can be null
  }).isRequired,
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

