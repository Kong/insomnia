import React, {Component, PropTypes} from 'react';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs'

import KeyValueEditor from './base/KeyValueEditor';

import ContentTypeDropdown from './ContentTypeDropdown';
import RenderedQueryString from './RenderedQueryString';
import RequestBodyEditor from './RequestBodyEditor';
import RequestAuthEditor from './RequestAuthEditor';
import RequestUrlBar from '../components/RequestUrlBar';

import {getContentTypeName} from '../lib/contentTypes';
import {getContentTypeFromHeaders} from '../lib/contentTypes';
import {MOD_SYM} from '../lib/constants';

class RequestPane extends Component {
  render () {
    const {
      request,
      showPasswords,
      editorFontSize,
      editorLineWrapping,
      sendRequest,
      updateRequestUrl,
      updateRequestMethod,
      updateRequestBody,
      updateRequestParameters,
      updateRequestAuthentication,
      updateRequestHeaders,
      updateRequestContentType,
      updateSettingsShowPasswords
    } = this.props;

    if (!request) {
      return (
        <section className="request-pane pane">
          <header className="pane__header"></header>
          <div className="pane__body pane__body--placeholder">
            <table>
              <tbody>
              <tr>
                <td>New Request</td>
                <td><code>{MOD_SYM}N</code></td>
              </tr>
              <tr>
                <td>Open Settings</td>
                <td><code>{MOD_SYM},</code></td>
              </tr>
              <tr>
                <td>Switch Requests</td>
                <td><code>{MOD_SYM}P</code></td>
              </tr>
              </tbody>
            </table>
          </div>
        </section>
      )
    }

    return (
      <section className="request-pane pane">
        <header className="pane__header">
          <RequestUrlBar
            sendRequest={() => sendRequest(request)}
            onUrlChange={updateRequestUrl}
            onMethodChange={updateRequestMethod}
            requestId={request._id}
            url={request.url}
            method={request.method}
          />
        </header>
        <Tabs className="pane__body">
          <TabList>
            <Tab>
              <button>{getContentTypeName(getContentTypeFromHeaders(request.headers))}</button>
              <ContentTypeDropdown updateRequestContentType={updateRequestContentType}/>
            </Tab>
            <Tab>
              <button>
                Auth {request.authentication.username ? <i className="fa fa-lock txt-sm"></i> : ''}
              </button>
            </Tab>
            <Tab>
              <button>
                Params {request.parameters.length ?
                <span className="txt-sm">({request.parameters.length})</span> : null}
              </button>
            </Tab>
            <Tab>
              <button>
                Headers {request.headers.length ? (
                <span className="txt-sm">({request.headers.length})</span> ) : null}
              </button>
            </Tab>
          </TabList>
          <TabPanel className="editor-wrapper">
            <RequestBodyEditor
              request={request}
              onChange={updateRequestBody}
              fontSize={editorFontSize}
              lineWrapping={editorLineWrapping}
            />
          </TabPanel>
          <TabPanel>
            <RequestAuthEditor
              showPasswords={showPasswords}
              request={request}
              onChange={updateRequestAuthentication}
            />
            <div className="pad pull-right txt-sm">
              <button className="btn btn--super-compact btn--outlined faint"
                      onClick={e => updateSettingsShowPasswords(!showPasswords)}>
                {showPasswords ? 'Hide Password' : 'Show Password'}
              </button>
            </div>
          </TabPanel>
          <TabPanel className="scrollable">
            <div className="pad no-pad-bottom">
              <label className="label--small">Url Preview</label>
              <code className="txt-sm block selectable">
                <RenderedQueryString
                  request={request}
                  placeholder="http://myproduct.com?name=Gregory"
                />
              </code>
            </div>
            <KeyValueEditor
              namePlaceholder="name"
              valuePlaceholder="value"
              uniquenessKey={request._id}
              pairs={request.parameters}
              onChange={updateRequestParameters}
            />
          </TabPanel>
          <TabPanel className="scrollable">
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
  }
}

RequestPane.propTypes = {
  // Functions
  sendRequest: PropTypes.func.isRequired,
  updateRequestUrl: PropTypes.func.isRequired,
  updateRequestMethod: PropTypes.func.isRequired,
  updateRequestBody: PropTypes.func.isRequired,
  updateRequestParameters: PropTypes.func.isRequired,
  updateRequestAuthentication: PropTypes.func.isRequired,
  updateRequestHeaders: PropTypes.func.isRequired,
  updateRequestContentType: PropTypes.func.isRequired,
  updateSettingsShowPasswords: PropTypes.func.isRequired,

  // Other
  showPasswords: PropTypes.bool.isRequired,
  editorFontSize: PropTypes.number.isRequired,
  editorLineWrapping: PropTypes.bool.isRequired,

  // Optional
  request: PropTypes.object,
};

export default RequestPane;
