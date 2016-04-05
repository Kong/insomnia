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
        <section className="grid__cell">
          <div className="grid--v">
            <header className="header">
              <div className="grid__cell">
                <RequestUrlBar
                  onUrlChange={updateRequestUrl}
                  onMethodChange={updateRequestMethod}
                  request={activeRequest}/>
              </div>
            </header>
            <div className="grid__cell grid--v bg-super-dark">
              <Tabs selectedIndex={0} className="grid--v">
                <TabList className="grid grid--left">
                  <Tab><button className="btn">Body</button></Tab>
                  <Tab><button className="btn">Params</button></Tab>
                  <Tab><button className="btn">Auth</button></Tab>
                  <Tab><button className="btn">Headers</button></Tab>
                </TabList>
                <TabPanel>
                  <RequestBodyEditor
                    className="grid-v"
                    onChange={updateRequestBody}
                    request={activeRequest}/>
                </TabPanel>
                <TabPanel className="pad">Params</TabPanel>
                <TabPanel className="pad">Basic Auth</TabPanel>
                <TabPanel className="pad">Headers</TabPanel>
              </Tabs>
            </div>
          </div>
        </section>
        <section className="grid__cell">
          <div className="grid--v">
            <header className="header text-center">
              <div className="grid grid--center">
                <div className="tag success"><strong>200</strong>&nbsp;SUCCESS</div>
                <div className="tag">TIME&nbsp;<strong>143ms</strong></div>
              </div>
            </header>
            <div className="grid--v">
              <Tabs selectedIndex={0} className="grid--v bg-super-dark">
                <TabList className="grid grid--left">
                  <Tab><button className="btn">Response</button></Tab>
                  <Tab><button className="btn">Raw</button></Tab>
                  <Tab><button className="btn">Headers</button></Tab>
                  <Tab><button className="btn">Cookies</button></Tab>
                </TabList>
                <TabPanel className="grid--v">
                  <Editor
                    className="grid--v"
                    options={{
                      mode: 'application/json',
                      readOnly: true,
                      placeholder: 'nothing yet...'
                    }}/>
                </TabPanel>
                <TabPanel>
                  <Editor
                    options={{
                      mode: 'application/json',
                      readOnly: true,
                      placeholder: 'nothing yet...'
                    }}/>
                </TabPanel>
                <TabPanel className="pad">Headers</TabPanel>
                <TabPanel className="pad">Cookies</TabPanel>
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
      <div className="grid bg-super-dark tall">
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
        <div className="grid__cell grid--v">
          <header className="header">
            <div className="header__content"><h1>Hi World</h1></div>
          </header>
          <div className="grid__cell">
            {this.renderPageBody(actions, activeRequest)}
          </div>
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

