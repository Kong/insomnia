import React, {Component, PropTypes} from 'react';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import KeyValueEditor from './base/KeyValueEditor';
import RequestHeadersEditor from './editors/RequestHeadersEditor';
import ContentTypeDropdown from './dropdowns/ContentTypeDropdown';
import RenderedQueryString from './RenderedQueryString';
import BodyEditor from './editors/body/BodyEditor';
import AuthEditor from './editors/AuthEditor';
import RequestUrlBar from './RequestUrlBar.js';
import {MOD_SYM, getContentTypeName, getContentTypeFromHeaders} from '../../common/constants';
import {debounce} from '../../common/misc';
import {getBodyDescription} from '../../models/request';

class RequestPane extends Component {
  render () {
    const {
      request,
      environmentId,
      handleImportFile,
      showPasswords,
      editorFontSize,
      editorLineWrapping,
      handleCreateRequest,
      handleSend,
      useBulkHeaderEditor,
      updateRequestUrl,
      updateRequestMethod,
      updateRequestBody,
      updateRequestParameters,
      updateRequestAuthentication,
      updateRequestHeaders,
      updateRequestMimeType,
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
                <button onClick={e => handleImportFile()}
                        className="btn inline-block btn--super-compact btn--outlined">
                  Import from File
                </button>
                <button onClick={e => handleCreateRequest()}
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
            key={request._id}
            method={request.method}
            onMethodChange={updateRequestMethod}
            onUrlChange={debounce(updateRequestUrl)}
            handleSend={handleSend}
            url={request.url}
          />
        </header>
        <Tabs className="pane__body">
          <TabList>
            <Tab>
              <button>
                {getContentTypeName(request.body.mimeType)}
              </button>
              <ContentTypeDropdown updateRequestMimeType={updateRequestMimeType}/>
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
              key={request._id}
              request={request}
              onChange={updateRequestBody}
              fontSize={editorFontSize}
              lineWrapping={editorLineWrapping}
            />
          </TabPanel>
          <TabPanel className="scrollable-container">
            <div className="scrollable">
              <AuthEditor
                key={request._id}
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
                    environmentId={environmentId}
                    placeholder="http://myproduct.com?name=Gregory"
                  />
                </code>
              </div>
              <KeyValueEditor
                key={request._id}
                namePlaceholder="name"
                valuePlaceholder="value"
                pairs={request.parameters}
                onChange={updateRequestParameters}
              />
            </div>
          </TabPanel>
          <TabPanel className="header-editor">
            <RequestHeadersEditor
              key={request._id}
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
  handleSend: PropTypes.func.isRequired,
  handleCreateRequest: PropTypes.func.isRequired,
  updateRequestUrl: PropTypes.func.isRequired,
  updateRequestMethod: PropTypes.func.isRequired,
  updateRequestBody: PropTypes.func.isRequired,
  updateRequestParameters: PropTypes.func.isRequired,
  updateRequestAuthentication: PropTypes.func.isRequired,
  updateRequestHeaders: PropTypes.func.isRequired,
  updateRequestMimeType: PropTypes.func.isRequired,
  updateSettingsShowPasswords: PropTypes.func.isRequired,
  updateSettingsUseBulkHeaderEditor: PropTypes.func.isRequired,
  handleImportFile: PropTypes.func.isRequired,

  // Other
  useBulkHeaderEditor: PropTypes.bool.isRequired,
  showPasswords: PropTypes.bool.isRequired,
  editorFontSize: PropTypes.number.isRequired,
  editorLineWrapping: PropTypes.bool.isRequired,
  environmentId: PropTypes.string.isRequired,

  // Optional
  request: PropTypes.object,
};

export default RequestPane;
