import React, {Component, PropTypes} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';

import CodeEditor from '../components/CodeEditor'
import UrlInput from '../components/UrlInput'
import Sidebar from '../components/Sidebar'

import * as RequestActions from '../actions/requests'
import * as GlobalActions from '../actions/global'

// Don't inject component styles (use our own)
Tabs.setUseDefaultStyles(false);

class App extends Component {
  renderPageBody() {
    const {actions, activeRequest} = this.props;

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
            <UrlInput onUrlChange={updateRequestUrl}
                      onMethodChange={updateRequestMethod}
                      method={activeRequest.method}
                      urlValue={activeRequest.url}/>
          </header>
          <div className="pane__body grid-v">
            <Tabs selectedIndex={0} className="grid-v">
              <TabList className="pane__header grid">
                <Tab><button className="btn">Body</button></Tab>
                <Tab><button className="btn">Params</button></Tab>
                <Tab><button className="btn">Auth</button></Tab>
                <Tab><button className="btn">Headers</button></Tab>
              </TabList>
              <TabPanel className="grid-v">
                <CodeEditor value={activeRequest.body}
                            className="grid-v"
                            onChange={updateRequestBody}
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
              <div className="tag success"><strong>200</strong> SUCCESS</div>
              <div className="tag"><strong>GET</strong> https://google.com</div>
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
    const {actions, loading, activeRequest, allRequests} = this.props;

    return (
      <div className="grid bg-dark">
        <Sidebar
          activateRequest={actions.activateRequest}
          addRequest={actions.addRequest}
          loading={loading}
          activeRequest={activeRequest}
          requests={allRequests}/>
        <div className="col">
          {this.renderPageBody()}
        </div>
      </div>
    )
  }
}

App.propTypes = {
  allRequests: PropTypes.array.isRequired,
  activeRequest: PropTypes.object,
  loading: PropTypes.bool.isRequired
};

function mapStateToProps (state) {
  return {
    actions: state.actions,
    allRequests: state.requests.all,
    activeRequest: state.requests.all.find(r => r.id === state.requests.active),
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

