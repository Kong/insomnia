import React, {PureComponent, PropTypes} from 'react';
import {parse as urlParse} from 'url';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import KeyValueEditor from './keyvalueeditor/Editor';
import RequestHeadersEditor from './editors/RequestHeadersEditor';
import ContentTypeDropdown from './dropdowns/ContentTypeDropdown';
import RenderedQueryString from './RenderedQueryString';
import BodyEditor from './editors/body/BodyEditor';
import AuthEditor from './editors/AuthEditor';
import RequestUrlBar from './RequestUrlBar.js';
import {MOD_SYM, getContentTypeName} from '../../common/constants';
import {debounce} from '../../common/misc';
import {trackEvent} from '../../analytics/index';
import * as querystring from '../../common/querystring';

class RequestPane extends PureComponent {
  _handleHidePasswords = () => this.props.updateSettingsShowPasswords(false);
  _handleShowPasswords = () => this.props.updateSettingsShowPasswords(true);

  _handleUpdateSettingsUseBulkHeaderEditor = () => {
    const {useBulkHeaderEditor, updateSettingsUseBulkHeaderEditor} = this.props;
    updateSettingsUseBulkHeaderEditor(!useBulkHeaderEditor);
    trackEvent('Headers', 'Toggle Bulk', !useBulkHeaderEditor ? 'On' : 'Off');
  };

  _handleImportFile = () => {
    this.props.handleImportFile();
    trackEvent('Request Pane', 'CTA', 'Import');
  };

  _handleCreateRequest = () => {
    this.props.handleCreateRequest(this.props.request);
    trackEvent('Request Pane', 'CTA', 'New Request');
  };

  _handleImportQueryFromUrl = e => {
    const {request} = this.props;

    let parsed;
    try {
      parsed = urlParse(request.url);
    } catch (e) {
      console.warn('Failed to parse url to import querystring');
      return;
    }

    // Remove the search string (?foo=bar&...) from the Url
    const url = request.url.replace(parsed.search, '');
    const parameters = [
      ...request.parameters,
      ...querystring.deconstructToParams(parsed.query),
    ];

    this.props.forceUpdateRequest({url, parameters});
  };

  _trackQueryToggle = pair => trackEvent('Query', 'Toggle', pair.disabled ? 'Disable' : 'Enable');
  _trackQueryCreate = () => trackEvent('Query', 'Create');
  _trackQueryDelete = () => trackEvent('Query', 'Delete');
  _trackTabBody = () => trackEvent('Request Pane', 'View', 'Body');
  _trackTabHeaders = () => trackEvent('Request Pane', 'View', 'Headers');
  _trackTabAuthentication = () => trackEvent('Request Pane', 'View', 'Authentication');
  _trackTabQuery = () => trackEvent('Request Pane', 'View', 'Query');

  render () {
    const {
      request,
      environmentId,
      showPasswords,
      editorFontSize,
      editorKeyMap,
      editorLineWrapping,
      handleSend,
      handleSendAndDownload,
      handleRender,
      forceRefreshCounter,
      useBulkHeaderEditor,
      handleGenerateCode,
      handleImport,
      updateRequestUrl,
      updateRequestMethod,
      updateRequestBody,
      updateRequestParameters,
      updateRequestAuthentication,
      updateRequestHeaders,
      updateRequestMimeType,
      updateSettingsShowPasswords,
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
                  <td>Edit Environments</td>
                  <td className="text-right">
                    <code>{MOD_SYM}E</code>
                  </td>
                </tr>
                </tbody>
              </table>

              <div className="text-center pane__body--placeholder__cta">
                <button className="btn inline-block btn--clicky" onClick={this._handleImportFile}>
                  Import from File
                </button>
                <button className="btn inline-block btn--clicky"
                        onClick={this._handleCreateRequest}>
                  New Request
                </button>
              </div>
            </div>
          </div>
        </section>
      )
    }

    let numBodyParams = 0;
    if (request.body && request.body.params) {
      numBodyParams = request.body.params.filter(p => !p.disabled).length;
    }

    const numParameters = request.parameters.filter(p => !p.disabled).length;
    const numHeaders = request.headers.filter(h => !h.disabled).length;
    const hasAuth = !request.authentication.disabled && request.authentication.username;
    const urlHasQueryParameters = request.url.indexOf('?') >= 0;

    const uniqueKey = `${forceRefreshCounter}::${request._id}`;

    return (
      <section className="pane request-pane">
        <header className="pane__header">
          <RequestUrlBar
            key={uniqueKey}
            method={request.method}
            onMethodChange={updateRequestMethod}
            onUrlChange={debounce(updateRequestUrl)}
            handleImport={handleImport}
            handleGenerateCode={handleGenerateCode}
            handleSend={handleSend}
            handleSendAndDownload={handleSendAndDownload}
            handleRender={handleRender}
            url={request.url}
          />
        </header>
        <Tabs className="pane__body">
          <TabList>
            <Tab onClick={this._trackTabBody}>
              <button>
                {getContentTypeName(request.body.mimeType)}
                {" "}
                {numBodyParams ? <span className="txt-sm">({numBodyParams})</span> : null}
              </button>
              <ContentTypeDropdown onChange={updateRequestMimeType}
                                   contentType={request.body.mimeType}
                                   className="tall">
                <i className="fa fa-caret-down"></i>
              </ContentTypeDropdown>
            </Tab>
            <Tab onClick={this._trackTabAuthentication}>
              <button>
                Auth {hasAuth ? <i className="fa fa-lock txt-sm"></i> : null}
              </button>
            </Tab>
            <Tab onClick={this._trackTabQuery}>
              <button>
                Query {numParameters ? <span className="txt-sm">({numParameters})</span> : null}
              </button>
            </Tab>
            <Tab onClick={this._trackTabHeaders}>
              <button>
                Headers {numHeaders ? <span className="txt-sm">({numHeaders})</span> : null}
              </button>
            </Tab>
          </TabList>
          <TabPanel className="editor-wrapper">
            <BodyEditor
              handleUpdateRequestMimeType={updateRequestMimeType}
              handleRender={handleRender}
              key={uniqueKey}
              request={request}
              onChange={updateRequestBody}
              fontSize={editorFontSize}
              keyMap={editorKeyMap}
              lineWrapping={editorLineWrapping}
            />
          </TabPanel>
          <TabPanel className="scrollable-container">
            <div className="scrollable">
              <AuthEditor
                key={uniqueKey}
                showPasswords={showPasswords}
                authentication={request.authentication}
                handleUpdateSettingsShowPasswords={updateSettingsShowPasswords}
                handleRender={handleRender}
                onChange={updateRequestAuthentication}
              />
              <div className="pad pull-right">
                {showPasswords ? (
                    <button className="btn btn--clicky" onClick={this._handleHidePasswords}>
                      Hide Password
                    </button>
                  ) : (
                    <button className="btn btn--clicky" onClick={this._handleShowPasswords}>
                      Show Password
                    </button>
                  )}
              </div>
            </div>
          </TabPanel>
          <TabPanel className="query-editor">
            <div className="pad no-pad-bottom">
              <label className="label--small">
                Url Preview
              </label>
              <code className="txt-sm block">
                <RenderedQueryString
                  request={request}
                  environmentId={environmentId}
                  placeholder="http://awesome-api.com?name=Gregory"
                />
              </code>
            </div>
            <div className="scrollable-container">
              <div className="scrollable">
                <KeyValueEditor
                  key={uniqueKey}
                  namePlaceholder="name"
                  valuePlaceholder="value"
                  sortable={true}
                  onToggleDisable={this._trackQueryToggle}
                  onCreate={this._trackQueryCreate}
                  onDelete={this._trackQueryDelete}
                  pairs={request.parameters}
                  handleRender={handleRender}
                  onChange={updateRequestParameters}
                />
              </div>
            </div>

            <div className="pad-right text-right">
              <button className="margin-top-sm btn btn--clicky"
                      disabled={!urlHasQueryParameters}
                      title={urlHasQueryParameters ? 'Import querystring' : 'No query params to import'}
                      onClick={this._handleImportQueryFromUrl}>
                Import from Url
              </button>
            </div>
          </TabPanel>
          <TabPanel className="header-editor">
            <RequestHeadersEditor
              key={uniqueKey}
              headers={request.headers}
              handleRender={handleRender}
              onChange={updateRequestHeaders}
              bulk={useBulkHeaderEditor}
            />

            <div className="pad-right text-right">
              <button className="margin-top-sm btn btn--clicky"
                      onClick={this._handleUpdateSettingsUseBulkHeaderEditor}>
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
  forceUpdateRequest: PropTypes.func.isRequired,
  handleSend: PropTypes.func.isRequired,
  handleSendAndDownload: PropTypes.func.isRequired,
  handleCreateRequest: PropTypes.func.isRequired,
  handleGenerateCode: PropTypes.func.isRequired,
  handleRender: PropTypes.func.isRequired,
  updateRequestUrl: PropTypes.func.isRequired,
  updateRequestMethod: PropTypes.func.isRequired,
  updateRequestBody: PropTypes.func.isRequired,
  updateRequestParameters: PropTypes.func.isRequired,
  updateRequestAuthentication: PropTypes.func.isRequired,
  updateRequestHeaders: PropTypes.func.isRequired,
  updateRequestMimeType: PropTypes.func.isRequired,
  updateSettingsShowPasswords: PropTypes.func.isRequired,
  updateSettingsUseBulkHeaderEditor: PropTypes.func.isRequired,
  handleImport: PropTypes.func.isRequired,
  handleImportFile: PropTypes.func.isRequired,

  // Other
  useBulkHeaderEditor: PropTypes.bool.isRequired,
  showPasswords: PropTypes.bool.isRequired,
  editorFontSize: PropTypes.number.isRequired,
  editorKeyMap: PropTypes.string.isRequired,
  editorLineWrapping: PropTypes.bool.isRequired,
  workspace: PropTypes.object.isRequired,
  environmentId: PropTypes.string.isRequired,
  forceRefreshCounter: PropTypes.number.isRequired,

  // Optional
  request: PropTypes.object,
};

export default RequestPane;
