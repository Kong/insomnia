import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import {Tab, TabList, TabPanel, Tabs} from 'react-tabs';
import ContentTypeDropdown from './dropdowns/content-type-dropdown';
import AuthDropdown from './dropdowns/auth-dropdown';
import KeyValueEditor from './key-value-editor/editor';
import RequestHeadersEditor from './editors/request-headers-editor';
import RenderedQueryString from './rendered-query-string';
import BodyEditor from './editors/body/body-editor';
import AuthWrapper from './editors/auth/auth-wrapper';
import RequestUrlBar from './request-url-bar.js';
import {getAuthTypeName, getContentTypeName} from '../../common/constants';
import {debounce} from '../../common/misc';
import {trackEvent} from '../../analytics/index';
import * as querystring from '../../common/querystring';
import * as db from '../../common/database';
import * as models from '../../models';
import Hotkey from './hotkey';
import {showModal} from './modals/index';
import RequestSettingsModal from './modals/request-settings-modal';
import MarkdownPreview from './markdown-preview';

@autobind
class RequestPane extends PureComponent {
  constructor (props) {
    super(props);

    this._handleUpdateRequestUrl = debounce(this._handleUpdateRequestUrl);
  }

  _handleEditDescriptionAdd () {
    this._handleEditDescription(true);
  }

  _handleEditDescription (addDescription) {
    showModal(RequestSettingsModal, {
      request: this.props.request,
      forceEditMode: addDescription
    });
  }

  async _autocompleteUrls () {
    const docs = await db.withDescendants(
      this.props.workspace,
      models.request.type
    );

    const requestId = this.props.request ? this.props.request._id : 'n/a';

    const urls = docs.filter(d => (
      d.type === models.request.type && // Only requests
      d._id !== requestId && // Not current request
      d.url // Only ones with non-empty URLs
    )).map(r => r.url);

    return Array.from(new Set(urls));
  }

  _handleUpdateSettingsUseBulkHeaderEditor () {
    const {useBulkHeaderEditor, updateSettingsUseBulkHeaderEditor} = this.props;
    updateSettingsUseBulkHeaderEditor(!useBulkHeaderEditor);
    trackEvent('Headers', 'Toggle Bulk', !useBulkHeaderEditor ? 'On' : 'Off');
  }

  _handleImportFile () {
    this.props.handleImportFile();
    trackEvent('Request Pane', 'CTA', 'Import');
  }

  _handleCreateRequest () {
    this.props.handleCreateRequest(this.props.request);
    trackEvent('Request Pane', 'CTA', 'New Request');
  }

  _handleUpdateRequestUrl (url) {
    this.props.updateRequestUrl(url);
  }

  _handleImportQueryFromUrl () {
    const {request} = this.props;

    let query;
    try {
      query = querystring.extractFromUrl(request.url);
    } catch (e) {
      console.warn('Failed to parse url to import querystring');
      return;
    }

    // Remove the search string (?foo=bar&...) from the Url
    const url = request.url.replace(query, '');
    const parameters = [
      ...request.parameters,
      ...querystring.deconstructToParams(query)
    ];

    // Only update if url changed
    if (url !== request.url) {
      this.props.forceUpdateRequest({url, parameters});
    }
  }

  _trackQueryToggle (pair) {
    trackEvent('Query', 'Toggle', pair.disabled ? 'Disable' : 'Enable');
  }

  _trackQueryCreate () {
    trackEvent('Query', 'Create');
  }

  _trackQueryDelete () {
    trackEvent('Query', 'Delete');
  }

  _trackTabBody () {
    trackEvent('Request Pane', 'View', 'Body');
  }

  _trackTabHeaders () {
    trackEvent('Request Pane', 'View', 'Headers');
  }

  _trackTabDescription () {
    trackEvent('Request Pane', 'View', 'Description');
  }

  _trackTabAuthentication () {
    trackEvent('Request Pane', 'View', 'Authentication');
  }

  _trackTabQuery () {
    trackEvent('Request Pane', 'View', 'Query');
  }

  render () {
    const {
      editorFontSize,
      editorIndentSize,
      editorKeyMap,
      editorLineWrapping,
      forceRefreshCounter,
      handleGenerateCode,
      handleGetRenderContext,
      handleImport,
      handleRender,
      handleSend,
      handleSendAndDownload,
      oAuth2Token,
      request,
      showPasswords,
      updateRequestAuthentication,
      updateRequestBody,
      updateRequestHeaders,
      updateRequestMethod,
      updateRequestMimeType,
      updateRequestParameters,
      updateSettingsShowPasswords,
      useBulkHeaderEditor
    } = this.props;

    if (!request) {
      return (
        <section className="request-pane pane">
          <header className="pane__header"></header>
          <div className="pane__body pane__body--placeholder">
            <div>
              <table className="table--fancy">
                <tbody>
                <tr>
                  <td>New Request</td>
                  <td className="text-right">
                    <code><Hotkey char="N"/></code>
                  </td>
                </tr>
                <tr>
                  <td>Switch Requests</td>
                  <td className="text-right">
                    <code><Hotkey char="P"/></code>
                  </td>
                </tr>
                <tr>
                  <td>Edit Environments</td>
                  <td className="text-right">
                    <code><Hotkey char="E"/></code>
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
      );
    }

    let numBodyParams = 0;
    if (request.body && request.body.params) {
      numBodyParams = request.body.params.filter(p => !p.disabled).length;
    }

    const numParameters = request.parameters.filter(p => !p.disabled).length;
    const numHeaders = request.headers.filter(h => !h.disabled).length;
    const urlHasQueryParameters = request.url.indexOf('?') >= 0;

    const uniqueKey = `${forceRefreshCounter}::${request._id}`;

    return (
      <section className="pane request-pane">
        <header className="pane__header">
          <RequestUrlBar
            uniquenessKey={uniqueKey}
            method={request.method}
            onMethodChange={updateRequestMethod}
            onUrlChange={this._handleUpdateRequestUrl}
            handleAutocompleteUrls={this._autocompleteUrls}
            handleImport={handleImport}
            handleGenerateCode={handleGenerateCode}
            handleSend={handleSend}
            handleSendAndDownload={handleSendAndDownload}
            handleRender={handleRender}
            handleGetRenderContext={handleGetRenderContext}
            url={request.url}
            requestId={request._id}
          />
        </header>
        <Tabs className="pane__body" forceRenderTabPanel>
          <TabList>
            <Tab onClick={this._trackTabBody}>
              <ContentTypeDropdown onChange={updateRequestMimeType}
                                   contentType={request.body.mimeType}
                                   request={request}
                                   className="tall">
                {getContentTypeName(request.body.mimeType) || 'Body'}
                {' '}
                {numBodyParams ? <span className="bubble">{numBodyParams}</span> : null}
                <i className="fa fa-caret-down space-left"/>
              </ContentTypeDropdown>
            </Tab>
            <Tab onClick={this._trackTabAuthentication}>
              <AuthDropdown onChange={updateRequestAuthentication}
                            authentication={request.authentication}
                            className="tall">
                {getAuthTypeName(request.authentication.type) || 'Auth'}
                <i className="fa fa-caret-down space-left"/>
              </AuthDropdown>
            </Tab>
            <Tab onClick={this._trackTabQuery}>
              <button>
                Query {numParameters > 0 && <span className="bubble">{numParameters}</span>}
              </button>
            </Tab>
            <Tab onClick={this._trackTabHeaders}>
              <button>
                Header {numHeaders > 0 && <span className="bubble">{numHeaders}</span>}
              </button>
            </Tab>
            <Tab onClick={this._trackTabDescription}>
              <button>
                Description
                {request.description && (
                  <span className="bubble space-left">
                    <i className="fa fa--skinny fa-check txt-xxs"/>
                  </span>
                )}
              </button>
            </Tab>
          </TabList>
          <TabPanel className="editor-wrapper">
            <BodyEditor
              handleUpdateRequestMimeType={updateRequestMimeType}
              handleRender={handleRender}
              handleGetRenderContext={handleGetRenderContext}
              key={uniqueKey}
              request={request}
              onChange={updateRequestBody}
              fontSize={editorFontSize}
              indentSize={editorIndentSize}
              keyMap={editorKeyMap}
              lineWrapping={editorLineWrapping}
            />
          </TabPanel>
          <TabPanel className="scrollable-container">
            <div className="scrollable">
              <AuthWrapper
                key={uniqueKey}
                oAuth2Token={oAuth2Token}
                showPasswords={showPasswords}
                request={request}
                handleUpdateSettingsShowPasswords={updateSettingsShowPasswords}
                handleRender={handleRender}
                handleGetRenderContext={handleGetRenderContext}
                onChange={updateRequestAuthentication}
              />
            </div>
          </TabPanel>
          <TabPanel className="query-editor">
            <div className="pad pad-bottom-sm query-editor__preview">
              <label className="label--small no-pad-top">Url Preview</label>
              <code className="txt-sm block faint">
                <RenderedQueryString
                  key={uniqueKey}
                  handleRender={handleRender}
                  request={request}
                />
              </code>
            </div>
            <div className="scrollable-container">
              <div className="scrollable">
                <KeyValueEditor
                  sortable
                  key={uniqueKey}
                  namePlaceholder="name"
                  valuePlaceholder="value"
                  onToggleDisable={this._trackQueryToggle}
                  onCreate={this._trackQueryCreate}
                  onDelete={this._trackQueryDelete}
                  pairs={request.parameters}
                  handleRender={handleRender}
                  handleGetRenderContext={handleGetRenderContext}
                  onChange={updateRequestParameters}
                />
              </div>
            </div>
            <div className="pad-right text-right">
              <button className="margin-top-sm btn btn--clicky"
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
              handleGetRenderContext={handleGetRenderContext}
              editorFontSize={editorFontSize}
              editorIndentSize={editorIndentSize}
              editorLineWrapping={editorLineWrapping}
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
          <TabPanel key={uniqueKey} className="tall scrollable">
            {request.description ? (
              <div>
                <div className="pull-right pad bg-default">
                  <button className="btn btn--clicky" onClick={this._handleEditDescription}>
                    Edit
                  </button>
                </div>
                <MarkdownPreview
                  className="pad"
                  debounceMillis={1000}
                  markdown={request.description}
                  handleRender={handleRender}
                />
              </div>
            ) : (
              <div className="overflow-hidden editor vertically-center text-center">
                <p className="pad text-sm text-center">
                  <span className="super-faint">
                  <i className="fa fa-file-text-o"
                     style={{fontSize: '8rem', opacity: 0.3}}
                  />
                  </span>
                  <br/><br/>
                  <button className="btn btn--clicky faint"
                          onClick={this._handleEditDescriptionAdd}>
                    Add Description
                  </button>
                </p>
              </div>
            )}
          </TabPanel>
        </Tabs>
      </section>
    );
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
  handleGetRenderContext: PropTypes.func.isRequired,
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
  editorIndentSize: PropTypes.number.isRequired,
  editorKeyMap: PropTypes.string.isRequired,
  editorLineWrapping: PropTypes.bool.isRequired,
  workspace: PropTypes.object.isRequired,
  forceRefreshCounter: PropTypes.number.isRequired,

  // Optional
  request: PropTypes.object,
  oAuth2Token: PropTypes.object
};

export default RequestPane;
