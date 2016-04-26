import React, {Component, PropTypes} from 'react'
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs'

import KeyValueEditor from '../components/base/KeyValueEditor'
import Dropdown from '../components/base/Dropdown'

import RequestBodyEditor from '../components/RequestBodyEditor'
import RequestAuthEditor from '../components/RequestAuthEditor'
import RequestUrlBar from '../components/RequestUrlBar'

class RequestPane extends Component {
  render () {
    const {
      request,
      sendRequest,
      updateRequestUrl,
      updateRequestMethod,
      updateRequestBody,
      updateRequestParams,
      updateRequestAuthentication,
      updateRequestHeaders
    } = this.props;

    if (!request) {
      return (
        <section className="grid__cell section section--bordered grid--v grid--start">
          <header className="header bg-super-light section__header"></header>
          <div className="section__body grid__cell"></div>
        </section>
      )
    }

    return (
      <section className="grid__cell section section--bordered">
        <div className="grid--v wide">
          <div className="header section__header">
            <RequestUrlBar
              uniquenessKey={request._id}
              sendRequest={() => sendRequest(request)}
              onUrlChange={updateRequestUrl}
              onMethodChange={updateRequestMethod}
              url={request.url}
              method={request.method}
            />
          </div>
          <Tabs className="grid__cell grid--v section__body">
            <TabList className="grid grid--start">
              <Tab className="no-wrap grid grid--center">
                <button>JSON</button>
                <Dropdown>
                  <button><i className="fa fa-caret-down"></i></button>
                  <ul>
                    {/*<li><button><i className="fa fa-picture-o"></i> File Upload</button></li>*/}
                    <li><button><i className="fa fa-bars"></i> Form Data</button></li>
                    <li><button><i className="fa fa-code"></i> XML</button></li>
                    <li><button><i className="fa fa-file-text"></i> Plain Text</button></li>
                  </ul>
                </Dropdown>
              </Tab>
              <Tab>
                <button className="no-wrap">
                  Params {request.params.length ? `(${request.params.length})` : ''}
                </button>
              </Tab>
              <Tab>
                <button className="no-wrap">
                  Headers {request.headers.length ? `(${request.headers.length})` : ''}
                </button>
              </Tab>
            </TabList>
            <TabPanel className="grid__cell editor-wrapper">
              <RequestBodyEditor
                onChange={updateRequestBody}
                requestId={request._id}
                contentType={request.contentType}
                body={request.body}
              />
            </TabPanel>
            <TabPanel className="grid__cell grid__cell--scroll--v">
              <div>
                <KeyValueEditor
                  className="pad"
                  namePlaceholder="name"
                  valuePlaceholder="value"
                  uniquenessKey={request._id}
                  pairs={request.params}
                  onChange={updateRequestParams}
                />
              </div>
            </TabPanel>
            <TabPanel className="grid__cell grid__cell--scroll--v">
              <div>
                <div className="pad">
                  <label>Basic Authentication</label>
                  <RequestAuthEditor
                    request={request}
                    onChange={updateRequestAuthentication}
                  />
                  <br/>
                  <label>Other Headers</label>
                  <KeyValueEditor
                    namePlaceholder="My-Header"
                    valuePlaceholder="Value"
                    uniquenessKey={request._id}
                    pairs={request.headers}
                    onChange={updateRequestHeaders}
                  />
                </div>
              </div>
            </TabPanel>
          </Tabs>
        </div>
      </section>
    )
  }
}

RequestPane.propTypes = {
  // Functions
  sendRequest: PropTypes.func.isRequired,
  updateRequestUrl: PropTypes.func.isRequired,
  updateRequestMethod: PropTypes.func.isRequired,
  updateRequestBody: PropTypes.func.isRequired,
  updateRequestParams: PropTypes.func.isRequired,
  updateRequestAuthentication: PropTypes.func.isRequired,
  updateRequestHeaders: PropTypes.func.isRequired,

  // Other
  request: PropTypes.object
};

export default RequestPane;
