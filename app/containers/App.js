import React, {Component, PropTypes} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';

import Editor from '../components/base/Editor'
import RequestBodyEditor from '../components/RequestBodyEditor'
import RequestUrlBar from '../components/RequestUrlBar'
import Sidebar from '../components/Sidebar'

import * as RequestActions from '../actions/requests'
import * as RequestGroupActions from '../actions/requestGroups'
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
        <section id="request-pane" className="pane col tall">
          <div className="grid-v">
            <header className="pane__header bg-super-dark">
              <RequestUrlBar
                onUrlChange={updateRequestUrl}
                onMethodChange={updateRequestMethod}
                request={activeRequest}/>
            </header>
            <div className="pane__body grid-v">
              <Tabs selectedIndex={0} className="grid-v">
                <TabList className="grid txt-sm">
                  <Tab><button className="btn btn--compact">Body</button></Tab>
                  <Tab><button className="btn btn--compact">Params</button></Tab>
                  <Tab><button className="btn btn--compact">Auth</button></Tab>
                  <Tab><button className="btn btn--compact">Headers</button></Tab>
                </TabList>
                <TabPanel className="grid-v">
                  <RequestBodyEditor
                    className="grid-v"
                    onChange={updateRequestBody}
                    request={activeRequest}/>
                </TabPanel>
                <TabPanel className="grid-v pad">Params</TabPanel>
                <TabPanel className="grid-v pad">Basic Auth</TabPanel>
                <TabPanel className="grid-v pad">Headers</TabPanel>
              </Tabs>
            </div>
          </div>
        </section>
        <section id="response-pane" className="pane col tall">
          <div className="grid-v">
            <header className="pane__header text-center bg-super-dark">
              <div className="grid">
                <div className="tag success"><strong>200</strong>&nbsp;SUCCESS</div>
                <div className="tag">TIME&nbsp;<strong>143ms</strong></div>
              </div>
            </header>
            <div className="pane__body grid-v">
              <Tabs selectedIndex={0} className="grid-v">
                <TabList className="grid txt-sm">
                  <Tab><button className="btn btn--compact">Response</button></Tab>
                  <Tab><button className="btn btn--compact">Raw</button></Tab>
                  <Tab><button className="btn btn--compact">Headers</button></Tab>
                  <Tab><button className="btn btn--compact">Cookies</button></Tab>
                </TabList>
                <TabPanel className="grid-v">
                  <Editor
                    className="grid-v"
                    options={{
                      mode: 'application/json',
                      readOnly: true,
                      placeholder: 'nothing yet...'
                    }}/>
                </TabPanel>
                <TabPanel className="grid-v">
                  <Editor
                    className="grid-v"
                    options={{
                      mode: 'application/json',
                      readOnly: true,
                      placeholder: 'nothing yet...'
                    }}/>
                </TabPanel>
                <TabPanel className="grid-v pad">Headers</TabPanel>
                <TabPanel className="grid-v pad">Cookies</TabPanel>
              </Tabs>
            </div>
          </div>
        </section>
      </div>
    )
  }

  render () {
    const {actions, loading, requests, requestGroups} = this.props;
    const activeRequest = requests.all.find(r => r.id === requests.active);

    return (
      <div className="grid bg-dark">
        <Sidebar
          activateRequest={actions.activateRequest}
          changeFilter={actions.changeFilter}
          addRequest={actions.addRequest}
          toggleRequestGroup={actions.toggleRequestGroup}
          activeRequest={activeRequest}
          activeFilter={requests.filter}
          loading={loading}
          requestGroups={requestGroups.all}
          requests={requests.all}/>
        <div className="col tall">
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
    changeFilter: PropTypes.func.isRequired,
    updateRequestMethod: PropTypes.func.isRequired,
    toggleRequestGroup: PropTypes.func.isRequired
  }).isRequired,
  requests: PropTypes.shape({
    all: PropTypes.array.isRequired,
    active: PropTypes.string // "required" but can be null
  }).isRequired,
  requestGroups: PropTypes.shape({
    all: PropTypes.array.isRequired
  }).isRequired,
  loading: PropTypes.bool.isRequired
};

function mapStateToProps (state) {
  return {
    actions: state.actions,
    requests: state.requests,
    requestGroups: state.requestGroups,
    loading: state.loading
  };
}

function mapDispatchToProps (dispatch) {
  return {
    actions: Object.assign(
      {},
      bindActionCreators(GlobalActions, dispatch),
      bindActionCreators(RequestActions, dispatch),
      bindActionCreators(RequestGroupActions, dispatch)
    )
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(App);

