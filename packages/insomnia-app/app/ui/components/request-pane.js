// @flow
import type {
  Request,
  RequestAuthentication,
  RequestBody,
  RequestHeader,
  RequestParameter,
} from '../../models/request';
import type { Workspace } from '../../models/workspace';
import type { OAuth2Token } from '../../models/o-auth-2-token';

import * as React from 'react';
import autobind from 'autobind-decorator';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import ContentTypeDropdown from './dropdowns/content-type-dropdown';
import AuthDropdown from './dropdowns/auth-dropdown';
import KeyValueEditor from './key-value-editor/editor';
import RequestHeadersEditor from './editors/request-headers-editor';
import RenderedQueryString from './rendered-query-string';
import BodyEditor from './editors/body/body-editor';
import AuthWrapper from './editors/auth/auth-wrapper';
import RequestUrlBar from './request-url-bar.js';
import { getAuthTypeName, getContentTypeName } from '../../common/constants';
import { deconstructQueryStringToParams, extractQueryStringFromUrl } from 'insomnia-url';
import * as db from '../../common/database';
import * as models from '../../models';
import Hotkey from './hotkey';
import { showModal } from './modals/index';
import RequestSettingsModal from './modals/request-settings-modal';
import MarkdownPreview from './markdown-preview';
import type { Settings } from '../../models/settings';
import * as hotkeys from '../../common/hotkeys';
import ErrorBoundary from './error-boundary';

type Props = {
  // Functions
  forceUpdateRequest: (r: Request, patch: Object) => Promise<Request>,
  forceUpdateRequestHeaders: (r: Request, headers: Array<RequestHeader>) => Promise<Request>,
  handleSend: () => void,
  handleSendAndDownload: (filepath?: string) => Promise<void>,
  handleCreateRequest: () => Promise<Request>,
  handleGenerateCode: Function,
  handleRender: Function,
  handleGetRenderContext: Function,
  updateRequestUrl: (r: Request, url: string) => Promise<Request>,
  updateRequestMethod: (r: Request, method: string) => Promise<Request>,
  updateRequestBody: (r: Request, body: RequestBody) => Promise<Request>,
  updateRequestParameters: (r: Request, params: Array<RequestParameter>) => Promise<Request>,
  updateRequestAuthentication: (r: Request, auth: RequestAuthentication) => Promise<Request>,
  updateRequestHeaders: (r: Request, headers: Array<RequestHeader>) => Promise<Request>,
  updateRequestMimeType: (r: Request, mimeType: string) => Promise<Request>,
  updateSettingsShowPasswords: Function,
  updateSettingsUseBulkHeaderEditor: Function,
  handleImport: Function,
  handleImportFile: Function,

  // Other
  workspace: Workspace,
  settings: Settings,
  isVariableUncovered: boolean,
  environmentId: string,
  forceRefreshCounter: number,

  // Optional
  request: ?Request,
  oAuth2Token: ?OAuth2Token,
};

@autobind
class RequestPane extends React.PureComponent<Props> {
  _handleEditDescriptionAdd() {
    this._handleEditDescription(true);
  }

  _handleEditDescription(addDescription: boolean) {
    showModal(RequestSettingsModal, {
      request: this.props.request,
      forceEditMode: addDescription,
    });
  }

  async _autocompleteUrls(): Promise<Array<string>> {
    const docs = await db.withDescendants(this.props.workspace, models.request.type);

    const requestId = this.props.request ? this.props.request._id : 'n/a';

    const urls = docs
      .filter(
        (d: any) =>
          d.type === models.request.type && // Only requests
          d._id !== requestId && // Not current request
          (d.url || ''), // Only ones with non-empty URLs
      )
      .map((r: any) => (r.url || '').trim());

    return Array.from(new Set(urls));
  }

  _handleUpdateSettingsUseBulkHeaderEditor() {
    const { settings, updateSettingsUseBulkHeaderEditor } = this.props;
    updateSettingsUseBulkHeaderEditor(!settings.useBulkHeaderEditor);
  }

  _handleImportFile() {
    this.props.handleImportFile();
  }

  _handleCreateRequest() {
    this.props.handleCreateRequest();
  }

  _handleUpdateRequestParameters(parameters: Array<RequestParameter>) {
    const { request, updateRequestParameters } = this.props;
    if (request) {
      updateRequestParameters(request, parameters);
    }
  }

  _handleImportQueryFromUrl() {
    const { request, forceUpdateRequest } = this.props;

    if (!request) {
      console.warn('Tried to import query when no request active');
      return;
    }

    let query;
    try {
      query = extractQueryStringFromUrl(request.url);
    } catch (e) {
      console.warn('Failed to parse url to import querystring');
      return;
    }

    // Remove the search string (?foo=bar&...) from the Url
    const url = request.url.replace(query, '');
    const parameters = [...request.parameters, ...deconstructQueryStringToParams(query)];

    // Only update if url changed
    if (url !== request.url) {
      forceUpdateRequest(request, { url, parameters });
    }
  }

  render() {
    const {
      forceRefreshCounter,
      forceUpdateRequestHeaders,
      handleGenerateCode,
      handleGetRenderContext,
      handleImport,
      handleRender,
      handleSend,
      handleSendAndDownload,
      oAuth2Token,
      request,
      workspace,
      environmentId,
      settings,
      isVariableUncovered,
      updateRequestAuthentication,
      updateRequestBody,
      updateRequestHeaders,
      updateRequestMimeType,
      updateSettingsShowPasswords,
      updateRequestMethod,
      updateRequestUrl,
    } = this.props;

    const paneClasses = 'request-pane theme--pane pane';
    const paneHeaderClasses = 'pane__header theme--pane__header';
    const paneBodyClasses = 'pane__body theme--pane__body';

    if (!request) {
      return (
        <section className={paneClasses}>
          <header className={paneHeaderClasses}/>
          <div className={paneBodyClasses + ' pane__body--placeholder'}>
            <div>
              <table className="table--fancy">
                <tbody>
                <tr>
                  <td>New Request</td>
                  <td className="text-right">
                    <code>
                      <Hotkey hotkey={hotkeys.CREATE_REQUEST}/>
                    </code>
                  </td>
                </tr>
                <tr>
                  <td>Switch Requests</td>
                  <td className="text-right">
                    <code>
                      <Hotkey hotkey={hotkeys.SHOW_QUICK_SWITCHER}/>
                    </code>
                  </td>
                </tr>
                <tr>
                  <td>Edit Environments</td>
                  <td className="text-right">
                    <code>
                      <Hotkey hotkey={hotkeys.SHOW_ENVIRONMENTS}/>
                    </code>
                  </td>
                </tr>
                </tbody>
              </table>

              <div className="text-center pane__body--placeholder__cta">
                <button className="btn inline-block btn--clicky" onClick={this._handleImportFile}>
                  Import from File
                </button>
                <button
                  className="btn inline-block btn--clicky"
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
      <section className={paneClasses}>
        <header className={paneHeaderClasses}>
          <ErrorBoundary errorClassName="font-error pad text-center">
            <RequestUrlBar
              uniquenessKey={uniqueKey}
              onMethodChange={updateRequestMethod}
              onUrlChange={updateRequestUrl}
              handleAutocompleteUrls={this._autocompleteUrls}
              handleImport={handleImport}
              handleGenerateCode={handleGenerateCode}
              handleSend={handleSend}
              handleSendAndDownload={handleSendAndDownload}
              handleRender={handleRender}
              nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
              isVariableUncovered={isVariableUncovered}
              handleGetRenderContext={handleGetRenderContext}
              request={request}
            />
          </ErrorBoundary>
        </header>
        <Tabs className={paneBodyClasses + ' react-tabs'} forceRenderTabPanel>
          <TabList>
            <Tab tabIndex="-1">
              <ContentTypeDropdown
                onChange={updateRequestMimeType}
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
            <Tab tabIndex="-1">
              <AuthDropdown
                onChange={updateRequestAuthentication}
                request={request}
                className="tall">
                {getAuthTypeName(request.authentication.type) || 'Auth'}
                <i className="fa fa-caret-down space-left"/>
              </AuthDropdown>
            </Tab>
            <Tab tabIndex="-1">
              <button>
                Query
                {numParameters > 0 && <span className="bubble space-left">{numParameters}</span>}
              </button>
            </Tab>
            <Tab tabIndex="-1">
              <button>
                Header
                {numHeaders > 0 && <span className="bubble space-left">{numHeaders}</span>}
              </button>
            </Tab>
            <Tab tabIndex="-1">
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
              key={uniqueKey}
              handleUpdateRequestMimeType={updateRequestMimeType}
              handleRender={handleRender}
              handleGetRenderContext={handleGetRenderContext}
              request={request}
              workspace={workspace}
              environmentId={environmentId}
              settings={settings}
              onChange={updateRequestBody}
              onChangeHeaders={forceUpdateRequestHeaders}
              nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
              isVariableUncovered={isVariableUncovered}
            />
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel scrollable-container">
            <div className="scrollable">
              <ErrorBoundary key={uniqueKey} errorClassName="font-error pad text-center">
                <AuthWrapper
                  oAuth2Token={oAuth2Token}
                  showPasswords={settings.showPasswords}
                  request={request}
                  handleUpdateSettingsShowPasswords={updateSettingsShowPasswords}
                  handleRender={handleRender}
                  handleGetRenderContext={handleGetRenderContext}
                  nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
                  isVariableUncovered={isVariableUncovered}
                  onChange={updateRequestAuthentication}
                />
              </ErrorBoundary>
            </div>
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel query-editor">
            <div className="pad pad-bottom-sm query-editor__preview">
              <label className="label--small no-pad-top">Url Preview</label>
              <code className="txt-sm block faint">
                <ErrorBoundary
                  key={uniqueKey}
                  errorClassName="tall wide vertically-align font-error pad text-center">
                  <RenderedQueryString handleRender={handleRender} request={request}/>
                </ErrorBoundary>
              </code>
            </div>
            <div className="query-editor__editor">
              <ErrorBoundary
                key={uniqueKey}
                errorClassName="tall wide vertically-align font-error pad text-center">
                <KeyValueEditor
                  sortable
                  allowMultiline
                  namePlaceholder="name"
                  valuePlaceholder="value"
                  pairs={request.parameters}
                  handleRender={handleRender}
                  handleGetRenderContext={handleGetRenderContext}
                  nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
                  isVariableUncovered={isVariableUncovered}
                  onChange={this._handleUpdateRequestParameters}
                />
              </ErrorBoundary>
            </div>
            <div className="pad-right text-right">
              <button
                className="margin-top-sm btn btn--clicky"
                title={urlHasQueryParameters ? 'Import querystring' : 'No query params to import'}
                onClick={this._handleImportQueryFromUrl}>
                Import from URL
              </button>
            </div>
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel header-editor">
            <ErrorBoundary key={uniqueKey} errorClassName="font-error pad text-center">
              <RequestHeadersEditor
                handleRender={handleRender}
                handleGetRenderContext={handleGetRenderContext}
                nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
                isVariableUncovered={isVariableUncovered}
                editorFontSize={settings.editorFontSize}
                editorIndentSize={settings.editorIndentSize}
                editorLineWrapping={settings.editorLineWrapping}
                onChange={updateRequestHeaders}
                request={request}
                bulk={settings.useBulkHeaderEditor}
              />
            </ErrorBoundary>

            <div className="pad-right text-right">
              <button
                className="margin-top-sm btn btn--clicky"
                onClick={this._handleUpdateSettingsUseBulkHeaderEditor}>
                {settings.useBulkHeaderEditor ? 'Regular Edit' : 'Bulk Edit'}
              </button>
            </div>
          </TabPanel>
          <TabPanel key={`docs::${uniqueKey}`} className="react-tabs__tab-panel tall scrollable">
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
                    <i className="fa fa-file-text-o" style={{ fontSize: '8rem', opacity: 0.3 }}/>
                  </span>
                  <br/>
                  <br/>
                  <button
                    className="btn btn--clicky faint"
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
