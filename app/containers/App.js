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
      <div className="grid__cell grid grid-collapse">
        <section className="grid__cell grid--v">
          <div className="grid__cell grid__cell--no-flex">
            <RequestUrlBar
              onUrlChange={updateRequestUrl}
              onMethodChange={updateRequestMethod}
              request={activeRequest}/>
          </div>
          <Tabs selectedIndex={0} className="grid__cell grid--v">
            <TabList className="grid grid--start">
              <Tab><button className="btn btn--compact">Body</button></Tab>
              <Tab><button className="btn btn--compact">Params</button></Tab>
              <Tab><button className="btn btn--compact">Auth</button></Tab>
              <Tab><button className="btn btn--compact">Headers</button></Tab>
            </TabList>
            <TabPanel className="grid__cell relative">
              <RequestBodyEditor
                onChange={updateRequestBody}
                request={activeRequest}/>
            </TabPanel>
            <TabPanel className="grid__cell pad">Params</TabPanel>
            <TabPanel className="grid__cell pad">Basic Auth</TabPanel>
            <TabPanel className="grid__cell pad">Headers</TabPanel>
          </Tabs>
        </section>
        <section className="grid__cell grid--v">
          <header className="grid grid--center header text-center bg-light txt-sm">
            <div className="tag success"><strong>200</strong>&nbsp;SUCCESS</div>
            <div className="tag">TIME&nbsp;<strong>143ms</strong></div>
          </header>
          <Tabs selectedIndex={0} className="grid__cell grid--v">
            <TabList className="grid grid--start">
              <Tab><button className="btn btn--compact">Response</button></Tab>
              <Tab><button className="btn btn--compact">Raw</button></Tab>
              <Tab><button className="btn btn--compact">Headers</button></Tab>
            </TabList>
            <TabPanel className="grid__cell">
              <Editor
                options={{
                  mode: 'application/json',
                  readOnly: true,
                  placeholder: 'nothing yet...'
                }}
              />
            </TabPanel>
            <TabPanel className="grid__cell">
              <Editor
                options={{
                  mode: 'application/json',
                  readOnly: true,
                  placeholder: 'nothing yet...'
                }}
              />
            </TabPanel>
            <TabPanel className="pad grid__cell">Headers</TabPanel>
          </Tabs>
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
          {/*<header className="header bg-light">
            <div className="header__content"><h1>Hi World</h1></div>
          </header>*/}
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

