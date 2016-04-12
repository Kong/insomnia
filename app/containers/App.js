import React, {Component, PropTypes} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs'

import Editor from '../components/base/Editor'
import Modals from '../components/modals/ModalContainer'
import KeyValueEditor from '../components/base/KeyValueEditor'
import RequestBodyEditor from '../components/RequestBodyEditor'
import RequestAuthEditor from '../components/RequestAuthEditor'
import RequestUrlBar from '../components/RequestUrlBar'
import Sidebar from '../components/Sidebar'

import * as GlobalActions from '../actions/global'
import * as RequestGroupActions from '../actions/requestGroups'
import * as RequestActions from '../actions/requests'
import * as ResponseActions from '../actions/responses'

// Don't inject component styles (use our own)
Tabs.setUseDefaultStyles(false);

class App extends Component {
  _renderPageBody (actions, activeRequest, activeResponse, tabs) {
    if (!activeRequest) {
      return <div></div>;
    }

    return (
      <div className="grid__cell grid grid--collapse">
        <section className="grid__cell section">
          <div className="grid--v wide">
            <div className="grid__cell grid__cell--no-flex section__header">
              <RequestUrlBar
                sendRequest={actions.sendRequest}
                onUrlChange={url => {actions.updateRequest({id: activeRequest.id, url})}}
                onMethodChange={method => {actions.updateRequest({id: activeRequest.id, method})}}
                request={activeRequest}/>
            </div>
            <Tabs className="grid__cell grid--v section__body"
                  onSelect={i => actions.selectTab('request', i)}
                  selectedIndex={tabs.request || 0}>
              <TabList className="grid grid--start">
                <Tab><button className="btn btn--compact">Body</button></Tab>
                <Tab>
                  <button className="btn btn--compact no-wrap">
                    Params {activeRequest.params.length ? `(${activeRequest.params.length})` : ''}
                  </button>
                </Tab>
                <Tab><button className="btn btn--compact">Auth</button></Tab>
                <Tab>
                  <button className="btn btn--compact no-wrap">
                    Headers {activeRequest.headers.length ? `(${activeRequest.headers.length})` : ''}
                  </button>
                </Tab>
              </TabList>
              <TabPanel className="grid__cell relative">
                <RequestBodyEditor
                  onChange={body => {actions.updateRequest({id: activeRequest.id, body})}}
                  request={activeRequest}/>
              </TabPanel>
              <TabPanel className="grid__cell scrollable">
                <KeyValueEditor
                  pairs={activeRequest.params}
                  onChange={params => actions.updateRequest({id: activeRequest.id, params})}
                />
              </TabPanel>
              <TabPanel className="grid__cell scrollable">
                <RequestAuthEditor
                  request={activeRequest}
                  onChange={authentication => actions.updateRequest({id: activeRequest.id, authentication})}
                />
              </TabPanel>
              <TabPanel className="grid__cell scrollable">
                <KeyValueEditor
                  pairs={activeRequest.headers}
                  onChange={headers => actions.updateRequest({id: activeRequest.id, headers})}
                />
              </TabPanel>
            </Tabs>
          </div>
        </section>
        <section className="grid__cell section">
          <div className="grid--v wide">
            <header
              className="grid grid--center header text-center bg-super-light txt-sm section__header">
              <div className="tag success"><strong>200</strong>&nbsp;SUCCESS</div>
              <div className="tag">TIME&nbsp;<strong>143ms</strong></div>
            </header>
            <Tabs className="grid__cell grid--v section__body"
                  onSelect={i => actions.selectTab('response', i)}
                  selectedIndex={tabs.response || 0}>
              <TabList className="grid grid--start">
                <Tab><button className="btn btn--compact">Preview</button></Tab>
                <Tab><button className="btn btn--compact">Raw</button></Tab>
                <Tab><button className="btn btn--compact">Headers</button></Tab>
              </TabList>
              <TabPanel className="grid__cell">
                <Editor
                  value={activeResponse && activeResponse.body || ''}
                  prettify={true}
                  options={{
                    mode: activeResponse && activeResponse.contentType || 'text/plain',
                    readOnly: true,
                    placeholder: 'nothing yet...'
                  }}
                />
              </TabPanel>
              <TabPanel className="grid__cell">
                <Editor
                  value={activeResponse && activeResponse.body || ''}
                  options={{
                    lineWrapping: true,
                    mode: 'text/plain',
                    readOnly: true,
                    placeholder: 'nothing yet...'
                  }}
                />
              </TabPanel>
              <TabPanel className="grid__cell scrollable">
                <div className="grid--v grid--start wide pad">
                  {!activeResponse ? null : activeResponse.headers.map((h, i) => (
                    <div className="grid grid__cell grid__cell--no-flex selectabletall" key={i}>
                      <div className="grid__cell">{h.name}</div>
                      <div className="grid__cell">{h.value}</div>
                    </div>
                  ))}
                </div>
              </TabPanel>
            </Tabs>
          </div>
        </section>
      </div>
    )
  }

  render () {
    const {actions, requests, responses, requestGroups, tabs} = this.props;
    const activeRequest = requests.all.find(r => r.id === requests.active);
    const activeResponse = responses[activeRequest && activeRequest.id];

    return (
      <div className="grid bg-super-dark tall">
        <Modals />
        <Sidebar
          activateRequest={actions.activateRequest}
          changeFilter={actions.changeFilter}
          addRequest={actions.addRequest}
          toggleRequestGroup={actions.toggleRequestGroup}
          deleteRequestGroup={actions.deleteRequestGroup}
          updateRequestGroup={actions.updateRequestGroup}
          activeRequest={activeRequest}
          activeFilter={requests.filter}
          requestGroups={requestGroups.all}
          requests={requests.all}/>
        <div className="grid__cell grid--v">
          {/*<header className="header bg-light">
           <div className="header__content"><h1>Hi World</h1></div>
           </header>*/}
          {this._renderPageBody(actions, activeRequest, activeResponse, tabs)}
        </div>
      </div>
    )
  }
}

App.propTypes = {
  actions: PropTypes.shape({
    activateRequest: PropTypes.func.isRequired,
    deleteRequestGroup: PropTypes.func.isRequired,
    addRequest: PropTypes.func.isRequired,
    sendRequest: PropTypes.func.isRequired,
    updateRequest: PropTypes.func.isRequired,
    changeFilter: PropTypes.func.isRequired,
    toggleRequestGroup: PropTypes.func.isRequired,
    updateRequestGroup: PropTypes.func.isRequired
  }).isRequired,
  requestGroups: PropTypes.shape({
    all: PropTypes.array.isRequired
  }).isRequired,
  requests: PropTypes.shape({
    all: PropTypes.array.isRequired,
    active: PropTypes.string // "required" but can be null
  }).isRequired,
  responses: PropTypes.object.isRequired,
  tabs: PropTypes.object.isRequired
};

function mapStateToProps (state) {
  return {
    actions: state.actions,
    requests: state.requests,
    requestGroups: state.requestGroups,
    responses: state.responses,
    tabs: state.tabs
  };
}

function mapDispatchToProps (dispatch) {
  return {
    actions: Object.assign(
      {},
      bindActionCreators(GlobalActions, dispatch),
      bindActionCreators(RequestGroupActions, dispatch),
      bindActionCreators(RequestActions, dispatch),
      bindActionCreators(ResponseActions, dispatch)
    )
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(App);

