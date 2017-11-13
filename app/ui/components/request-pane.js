// @flow
import type {Request} from '../../models/request';
import type {Workspace} from '../../models/workspace';
import type {OAuth2Token} from '../../models/o-auth-2-token';

import * as React from 'react';
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
import {DEBOUNCE_MILLIS, getAuthTypeName, getContentTypeName} from '../../common/constants';
import {trackEvent} from '../../analytics/index';
import * as querystring from '../../common/querystring';
import * as db from '../../common/database';
import * as models from '../../models';
import Hotkey from './hotkey';
import {showModal} from './modals/index';
import RequestSettingsModal from './modals/request-settings-modal';
import MarkdownPreview from './markdown-preview';
import type {Settings} from '../../models/settings';
import * as hotkeys from '../../common/hotkeys';
import ErrorBoundary from './error-boundary';

type Props = {
  // Functions
  forceUpdateRequest: Function,
  forceUpdateRequestHeaders: Function,
  handleSend: Function,
  handleSendAndDownload: Function,
  handleCreateRequest: Function,
  handleGenerateCode: Function,
  handleRender: Function,
  handleGetRenderContext: Function,
  updateRequestUrl: Function,
  updateRequestMethod: Function,
  updateRequestBody: Function,
  updateRequestParameters: Function,
  updateRequestAuthentication: Function,
  updateRequestHeaders: Function,
  updateRequestMimeType: Function,
  updateSettingsShowPasswords: Function,
  updateSettingsUseBulkHeaderEditor: Function,
  handleImport: Function,
  handleImportFile: Function,

  // Other
  useBulkHeaderEditor: boolean,
  showPasswords: boolean,
  editorFontSize: number,
  editorIndentSize: number,
  nunjucksPowerUserMode: boolean,
  editorKeyMap: string,
  editorLineWrapping: boolean,
  workspace: Workspace,
  settings: Settings,
  environmentId: string,
  forceRefreshCounter: number,

  // Optional
  request: ?Request,
  oAuth2Token: ?OAuth2Token
};

@autobind
class RequestPane extends React.PureComponent<Props> {
  _handleUpdateRequestUrlTimeout: number;

  _handleEditDescriptionAdd () {
    this._handleEditDescription(true);
  }

  _handleEditDescription (addDescription: boolean) {
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
      (d.url || '') // Only ones with non-empty URLs
    )).map(r => r.url || '');

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

  _handleUpdateRequestUrl (url: string) {
    clearTimeout(this._handleUpdateRequestUrlTimeout);
    this._handleUpdateRequestUrlTimeout = setTimeout(() => {
      this.props.updateRequestUrl(url);
    }, DEBOUNCE_MILLIS);
  }

  _handleImportQueryFromUrl () {
    const {request} = this.props;

    if (!request) {
      console.warn('Tried to import query when no request active');
      return;
    }

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

  _trackQueryToggle (pair: {disabled: boolean}) {
    trackEvent('Query', 'Toggle', pair.disabled ? 'Disable' : 'Enable');
  }

  _trackQueryCreate () {
    trackEvent('Query', 'Create');
  }

  _trackQueryDelete () {
    trackEvent('Query', 'Delete');
  }

  render () {
    const {
      editorFontSize,
      editorIndentSize,
      editorKeyMap,
      editorLineWrapping,
      forceRefreshCounter,
      forceUpdateRequestHeaders,
      handleGenerateCode,
      handleGetRenderContext,
      handleImport,
      handleRender,
      nunjucksPowerUserMode,
      handleSend,
      handleSendAndDownload,
      oAuth2Token,
      request,
      workspace,
      environmentId,
      settings,
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
                    <code><Hotkey hotkey={hotkeys.CREATE_REQUEST}/></code>
                  </td>
                </tr>
                <tr>
                  <td>Switch Requests</td>
                  <td className="text-right">
                    <code><Hotkey hotkey={hotkeys.SHOW_QUICK_SWITCHER}/></code>
                  </td>
                </tr>
                <tr>
                  <td>Edit Environments</td>
                  <td className="text-right">
                    <code><Hotkey hotkey={hotkeys.SHOW_ENVIRONMENTS}/></code>
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
          <ErrorBoundary errorClassName="font-error pad text-center">
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
              nunjucksPowerUserMode={nunjucksPowerUserMode}
              handleGetRenderContext={handleGetRenderContext}
              url={request.url}
              requestId={request._id}
            />
          </ErrorBoundary>
        </header>
        <Tabs className="react-tabs pane__body" forceRenderTabPanel>
          <TabList>
            <Tab>
              <ContentTypeDropdown onChange={updateRequestMimeType}
                                   contentType={request.body.mimeType}
                                   request={request}
                                   className="tall">
                {typeof request.body.mimeType === 'string'
                  ? getContentTypeName(request.body.mimeType)
                  : 'Body'}
                {numBodyParams ? <span className="bubble space-left">{numBodyParams}</span> : null}
                <i className="fa fa-caret-down space-left"/>
              </ContentTypeDropdown>
            </Tab>
            <Tab>
              <AuthDropdown onChange={updateRequestAuthentication}
                            authentication={request.authentication}
                            className="tall">
                {getAuthTypeName(request.authentication.type) || 'Auth'}
                <i className="fa fa-caret-down space-left"/>
              </AuthDropdown>
            </Tab>
            <Tab>
              <button>
                Query
                {numParameters > 0 && <span className="bubble space-left">{numParameters}</span>}
              </button>
            </Tab>
            <Tab>
              <button>
                Header
                {numHeaders > 0 && <span className="bubble space-left">{numHeaders}</span>}
              </button>
            </Tab>
            <Tab>
              <button>
                Docs
                {request.description && (
                  <span className="bubble space-left">
                    <i className="fa fa--skinny fa-check txt-xxs"/>
                  </span>
                )}
              </button>
            </Tab>
          </TabList>
          <TabPanel key={uniqueKey} className="react-tabs__tab-panel editor-wrapper">
            <BodyEditor
              handleUpdateRequestMimeType={updateRequestMimeType}
              handleRender={handleRender}
              handleGetRenderContext={handleGetRenderContext}
              nunjucksPowerUserMode={nunjucksPowerUserMode}
              request={request}
              workspace={workspace}
              environmentId={environmentId}
              settings={settings}
              onChange={updateRequestBody}
              onChangeHeaders={forceUpdateRequestHeaders}
              fontSize={editorFontSize}
              indentSize={editorIndentSize}
              keyMap={editorKeyMap}
              lineWrapping={editorLineWrapping}
            />
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel scrollable-container">
            <div className="scrollable">
              <ErrorBoundary key={uniqueKey} errorClassName="font-error pad text-center">
                <AuthWrapper
                  oAuth2Token={oAuth2Token}
                  showPasswords={showPasswords}
                  request={request}
                  handleUpdateSettingsShowPasswords={updateSettingsShowPasswords}
                  handleRender={handleRender}
                  handleGetRenderContext={handleGetRenderContext}
                  nunjucksPowerUserMode={nunjucksPowerUserMode}
                  onChange={updateRequestAuthentication}
                />
              </ErrorBoundary>
            </div>
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel query-editor">
            <div className="pad pad-bottom-sm query-editor__preview">
              <label className="label--small no-pad-top">Url Preview</label>
              <code className="txt-sm block faint">
                <ErrorBoundary key={uniqueKey}
                  errorClassName="tall wide vertically-align font-error pad text-center">
                  <RenderedQueryString
                    handleRender={handleRender}
                    request={request}
                  />
                </ErrorBoundary>
              </code>
            </div>
            <div className="scrollable-container">
              <div className="scrollable">
                <ErrorBoundary key={uniqueKey}
                  errorClassName="tall wide vertically-align font-error pad text-center">
                  <KeyValueEditor
                    sortable
                    namePlaceholder="name"
                    valuePlaceholder="value"
                    onToggleDisable={this._trackQueryToggle}
                    onCreate={this._trackQueryCreate}
                    onDelete={this._trackQueryDelete}
                    pairs={request.parameters}
                    handleRender={handleRender}
                    handleGetRenderContext={handleGetRenderContext}
                    nunjucksPowerUserMode={nunjucksPowerUserMode}
                    onChange={updateRequestParameters}
                  />
                </ErrorBoundary>
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
          <TabPanel className="react-tabs__tab-panel header-editor">
            <ErrorBoundary key={uniqueKey} errorClassName="font-error pad text-center">
              <RequestHeadersEditor
                headers={request.headers}
                handleRender={handleRender}
                handleGetRenderContext={handleGetRenderContext}
                nunjucksPowerUserMode={nunjucksPowerUserMode}
                editorFontSize={editorFontSize}
                editorIndentSize={editorIndentSize}
                editorLineWrapping={editorLineWrapping}
                onChange={updateRequestHeaders}
                bulk={useBulkHeaderEditor}
              />
            </ErrorBoundary>

            <div className="pad-right text-right">
              <button className="margin-top-sm btn btn--clicky"
                      onClick={this._handleUpdateSettingsUseBulkHeaderEditor}>
                {useBulkHeaderEditor ? 'Regular Edit' : 'Bulk Edit'}
              </button>
            </div>
          </TabPanel>
          <TabPanel key={uniqueKey} className="react-tabs__tab-panel tall scrollable">
            {request.description ? (
              <div>
                <div className="pull-right pad bg-default">
                  <button className="btn btn--clicky" onClick={this._handleEditDescription}>
                    Edit
                  </button>
                </div>
                <div className="pad">
                  <ErrorBoundary errorClassName="font-error pad text-center">
                    <MarkdownPreview
                      heading={request.name}
                      debounceMillis={1000}
                      markdown={request.description}
                      handleRender={handleRender}
                    />
                  </ErrorBoundary>
                </div>
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

export default RequestPane;
