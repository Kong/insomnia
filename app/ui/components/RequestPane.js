import React, {Component, PropTypes} from 'react';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import KeyValueEditor from './base/KeyValueEditor';
import RequestHeadersEditor from './editors/RequestHeadersEditor';
import ContentTypeDropdown from './dropdowns/ContentTypeDropdown';
import RenderedQueryString from './RenderedQueryString';
import BodyEditor from './editors/BodyEditor';
import AuthEditor from './editors/AuthEditor';
import RequestUrlBar from './RequestUrlBar.js';
import {
  getContentTypeName,
  getContentTypeFromHeaders
} from '../../backend/contentTypes';
import {MOD_SYM} from '../../backend/constants';
import {debounce} from '../../backend/util';

class RequestPane extends Component {
  render () {
    const {
      request,
      importFile,
      showPasswords,
      editorFontSize,
      editorLineWrapping,
      requestCreate,
      sendRequest,
      useBulkHeaderEditor,
      updateRequestUrl,
      updateRequestMethod,
      updateRequestBody,
      updateRequestParameters,
      updateRequestAuthentication,
      updateRequestHeaders,
      updateRequestContentType,
      updateSettingsUseBulkHeaderEditor
    } = this.props;

    if (!request) {
      return (
        <section className="request-pane pane">
          <header className="pane__header"></header>
          <div className="pane__body pane__body--placeholder">
            <div>
              <table>
                <tbody>
                <tr>
                  <td>New Request</td>
                  <td className="text-right">
                    <code>{MOD_SYM}N</code>
                  </td>
                </tr>
                <tr>
                  <td>Switch Requests</td>
                  <td className="text-right">
                    <code>{MOD_SYM}P</code>
                  </td>
                </tr>
                <tr>
                  <td>Manage Cookies</td>
                  <td className="text-right">
                    <code>{MOD_SYM}K</code>
                  </td>
                </tr>
                <tr>
                  <td>Edit Environments</td>
                  <td className="text-right">
                    <code>{MOD_SYM}E</code>
                  </td>
                </tr>
                </tbody>
              </table>

              <div className="text-center pane__body--placeholder__cta">
                <button onClick={e => importFile()}
                        className="btn inline-block btn--super-compact btn--outlined">
                  Import from File
                </button>
                <button onClick={e => requestCreate()}
                        className="btn inline-block btn--super-compact btn--outlined">
                  New Request
                </button>
              </div>
            </div>
          </div>
        </section>
      )
    }

    return (
      <section className="pane request-pane">
        <header className="pane__header">
          <RequestUrlBar
            method={request.method}
            onMethodChange={updateRequestMethod}
            onUrlChange={debounce(updateRequestUrl)}
            sendRequest={sendRequest.bind(null, request)}
            url={request.url}
          />
        </header>
        <Tabs className="pane__body">
          <TabList>
            <Tab>
              <button>
                {getContentTypeName(getContentTypeFromHeaders(request.headers))}
              </button>
              <ContentTypeDropdown
                updateRequestContentType={updateRequestContentType}/>
            </Tab>
            <Tab>
              <button>
                Auth {request.authentication.username ?
                <i className="fa fa-lock txt-sm"></i> : ''}
              </button>
            </Tab>
            <Tab>
              <button>
                Query {request.parameters.length ?
                <span
                  className="txt-sm">({request.parameters.length})</span> : null}
              </button>
            </Tab>
            <Tab>
              <button>
                Headers {request.headers.length ? (
                <span
                  className="txt-sm">({request.headers.length})</span> ) : null}
              </button>
            </Tab>
          </TabList>
          <TabPanel className="editor-wrapper">
            <BodyEditor
              request={request}
              onChange={updateRequestBody}
              fontSize={editorFontSize}
              lineWrapping={editorLineWrapping}
            />
          </TabPanel>
          <TabPanel className="scrollable-container">
            <div className="scrollable">
              <AuthEditor
                showPasswords={showPasswords}
                request={request}
                onChange={updateRequestAuthentication}
              />
            </div>
          </TabPanel>
          <TabPanel className="scrollable-container">
            <div className="scrollable">
              <div className="pad no-pad-bottom">
                <label className="label--small">Url Preview</label>
                <code className="txt-sm block">
                  <RenderedQueryString
                    request={request}
                    placeholder="http://myproduct.com?name=Gregory"
                  />
                </code>
              </div>
              <KeyValueEditor
                namePlaceholder="name"
                valuePlaceholder="value"
                pairs={request.parameters}
                onChange={updateRequestParameters}
              />
            </div>
          </TabPanel>
          <TabPanel className="header-editor">
            <RequestHeadersEditor
              headers={request.headers}
              onChange={updateRequestHeaders}
              bulk={useBulkHeaderEditor}
            />

            <div className="pad-right text-right">
              <button
                className="margin-top-sm btn btn--outlined btn--super-compact"
                onClick={() => updateSettingsUseBulkHeaderEditor(!useBulkHeaderEditor)}>
                {useBulkHeaderEditor ? 'Regular Edit' : 'Bulk Edit'}
              </button>
            </div>
          </TabPanel>
        </Tabs>
      </section>
    )
  }
}

RequestPane.propTypes = {
  // Functions
  sendRequest: PropTypes.func.isRequired,
  requestCreate: PropTypes.func.isRequired,
  updateRequestUrl: PropTypes.func.isRequired,
  updateRequestMethod: PropTypes.func.isRequired,
  updateRequestBody: PropTypes.func.isRequired,
  updateRequestParameters: PropTypes.func.isRequired,
  updateRequestAuthentication: PropTypes.func.isRequired,
  updateRequestHeaders: PropTypes.func.isRequired,
  updateRequestContentType: PropTypes.func.isRequired,
  updateSettingsShowPasswords: PropTypes.func.isRequired,
  updateSettingsUseBulkHeaderEditor: PropTypes.func.isRequired,
  importFile: PropTypes.func.isRequired,

  // Other
  useBulkHeaderEditor: PropTypes.bool.isRequired,
  showPasswords: PropTypes.bool.isRequired,
  editorFontSize: PropTypes.number.isRequired,
  editorLineWrapping: PropTypes.bool.isRequired,

  // Optional
  request: PropTypes.object,
};

export default RequestPane;
