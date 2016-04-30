import React, {Component, PropTypes} from 'react'
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs'

import KeyValueEditor from '../components/base/KeyValueEditor'

import ContentTypeDropdown from '../components/ContentTypeDropdown'
import RequestBodyEditor from '../components/RequestBodyEditor'
import RequestAuthEditor from '../components/RequestAuthEditor'
import RequestUrlBar from '../components/RequestUrlBar'

import {getContentTypeName} from '../lib/contentTypes'

const RequestPane = props => {
  const {
    request,
    sendRequest,
    updateRequestUrl,
    updateRequestMethod,
    updateRequestBody,
    updateRequestParams,
    updateRequestAuthentication,
    updateRequestHeaders,
    updateRequestContentType
  } = props;

  if (!request) {
    return (
      <section className="request-pane pane">
        <header className="pane__header"></header>
        <div className="pane__body"></div>
      </section>
    )
  }

  return (
    <section className="request-pane pane">
      <header className="pane__header">
        <RequestUrlBar
          uniquenessKey={request._id}
          sendRequest={() => sendRequest(request)}
          onUrlChange={updateRequestUrl}
          onMethodChange={updateRequestMethod}
          url={request.url}
          method={request.method}
        />
      </header>
      <Tabs className="pane__body">
        <TabList>
          <Tab>
            <button>{getContentTypeName(request.contentType)}</button>
            <ContentTypeDropdown
              activeContentType={request.contentType}
              updateRequestContentType={updateRequestContentType}
            />
          </Tab>
          <Tab>
            <button>
              Params {request.params.length ? `(${request.params.length})` : ''}
            </button>
          </Tab>
          <Tab>
            <button>
              Headers {request.headers.length ? `(${request.headers.length})` : ''}
            </button>
          </Tab>
        </TabList>
        <TabPanel className="editor-wrapper">
          <RequestBodyEditor
            onChange={updateRequestBody}
            requestId={request._id}
            contentType={request.contentType}
            body={request.body}
          />
        </TabPanel>
        <TabPanel className="scrollable">
          <KeyValueEditor
            className="pad"
            namePlaceholder="name"
            valuePlaceholder="value"
            uniquenessKey={request._id}
            pairs={request.params}
            onChange={updateRequestParams}
          />
        </TabPanel>
        <TabPanel className="scrollable pad">
          <label>Basic Authentication</label>
          <RequestAuthEditor
            request={request}
            onChange={updateRequestAuthentication}
          />
          <br/>
          <br/>
          <label>Other Headers</label>
          <KeyValueEditor
            namePlaceholder="My-Header"
            valuePlaceholder="Value"
            uniquenessKey={request._id}
            pairs={request.headers}
            onChange={updateRequestHeaders}
          />
        </TabPanel>
      </Tabs>
    </section>
  )
};

RequestPane.propTypes = {
  // Functions
  sendRequest: PropTypes.func.isRequired,
  updateRequestUrl: PropTypes.func.isRequired,
  updateRequestMethod: PropTypes.func.isRequired,
  updateRequestBody: PropTypes.func.isRequired,
  updateRequestParams: PropTypes.func.isRequired,
  updateRequestAuthentication: PropTypes.func.isRequired,
  updateRequestHeaders: PropTypes.func.isRequired,
  updateRequestContentType: PropTypes.func.isRequired,

  // Other
  request: PropTypes.object
};

export default RequestPane;
