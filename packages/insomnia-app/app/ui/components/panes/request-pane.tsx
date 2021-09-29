import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import { deconstructQueryStringToParams, extractQueryStringFromUrl } from 'insomnia-url';
import React, { PureComponent } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';

import { AUTOBIND_CFG, getAuthTypeName, getContentTypeName } from '../../../common/constants';
import { HandleGetRenderContext, HandleRender } from '../../../common/render';
import * as models from '../../../models';
import { queryAllWorkspaceUrls } from '../../../models/helpers/query-all-workspace-urls';
import type { OAuth2Token } from '../../../models/o-auth-2-token';
import type {
  Request,
  RequestAuthentication,
  RequestBody,
  RequestHeader,
  RequestParameter,
} from '../../../models/request';
import type { Settings } from '../../../models/settings';
import type { Workspace } from '../../../models/workspace';
import { AuthDropdown } from '../dropdowns/auth-dropdown';
import { ContentTypeDropdown } from '../dropdowns/content-type-dropdown';
import { AuthWrapper } from '../editors/auth/auth-wrapper';
import { BodyEditor } from '../editors/body/body-editor';
import { RequestHeadersEditor } from '../editors/request-headers-editor';
import { RequestParametersEditor } from '../editors/request-parameters-editor';
import { ErrorBoundary } from '../error-boundary';
import { MarkdownPreview } from '../markdown-preview';
import { showModal } from '../modals';
import { RequestSettingsModal } from '../modals/request-settings-modal';
import { RenderedQueryString } from '../rendered-query-string';
import { RequestUrlBar } from '../request-url-bar';
import { Pane, paneBodyClasses, PaneHeader } from './pane';
import { PlaceholderRequestPane } from './placeholder-request-pane';

interface Props {
  // Functions
  forceUpdateRequest: (r: Request, patch: Partial<Request>) => Promise<Request>;
  forceUpdateRequestHeaders: (r: Request, headers: RequestHeader[]) => Promise<Request>;
  handleSend: () => void;
  handleSendAndDownload: (filepath?: string) => Promise<void>;
  handleCreateRequest: () => void;
  handleGenerateCode: Function;
  handleRender: HandleRender;
  handleGetRenderContext: HandleGetRenderContext;
  handleUpdateDownloadPath: Function;
  updateRequestUrl: (r: Request, url: string) => Promise<Request>;
  updateRequestMethod: (r: Request, method: string) => Promise<Request>;
  updateRequestBody: (r: Request, body: RequestBody) => Promise<Request>;
  updateRequestParameters: (r: Request, params: RequestParameter[]) => Promise<Request>;
  updateRequestAuthentication: (r: Request, auth: RequestAuthentication) => Promise<Request>;
  updateRequestHeaders: (r: Request, headers: RequestHeader[]) => Promise<Request>;
  updateRequestMimeType: (mimeType: string | null) => Promise<Request | null>;
  updateSettingsShowPasswords: (showPasswords: boolean) => Promise<Settings>;
  updateSettingsUseBulkHeaderEditor: Function;
  updateSettingsUseBulkParametersEditor: (useBulkParametersEditor: boolean) => Promise<Settings>;
  handleImport: Function;
  workspace: Workspace;
  settings: Settings;
  isVariableUncovered: boolean;
  environmentId: string;
  forceRefreshCounter: number;
  headerEditorKey: string;
  request?: Request | null;
  downloadPath: string | null;
  oAuth2Token?: OAuth2Token | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class RequestPane extends PureComponent<Props> {
  _handleEditDescriptionAdd() {
    this._handleEditDescription(true);
  }

  _handleEditDescription(addDescription: boolean) {
    showModal(RequestSettingsModal, {
      request: this.props.request,
      forceEditMode: addDescription,
    });
  }

  _autocompleteUrls(): Promise<string[]> {
    const { workspace, request } = this.props;
    return queryAllWorkspaceUrls(workspace, models.request.type, request?._id);
  }

  _handleUpdateSettingsUseBulkHeaderEditor() {
    const { settings, updateSettingsUseBulkHeaderEditor } = this.props;
    updateSettingsUseBulkHeaderEditor(!settings.useBulkHeaderEditor);
  }

  _handleUpdateSettingsUseBulkParametersEditor() {
    const { settings, updateSettingsUseBulkParametersEditor } = this.props;
    updateSettingsUseBulkParametersEditor(!settings.useBulkParametersEditor);
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
    const url = request.url.replace(`?${query}`, '');
    const parameters = [...request.parameters, ...deconstructQueryStringToParams(query)];

    // Only update if url changed
    if (url !== request.url) {
      forceUpdateRequest(request, {
        url,
        parameters,
      });
    }
  }

  render() {
    const {
      forceRefreshCounter,
      forceUpdateRequestHeaders,
      handleGenerateCode,
      handleGetRenderContext,
      handleImport,
      handleCreateRequest,
      handleRender,
      handleSend,
      handleSendAndDownload,
      handleUpdateDownloadPath,
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
      updateRequestParameters,
      updateRequestUrl,
      headerEditorKey,
      downloadPath,
    } = this.props;
    const hotKeyRegistry = settings.hotKeyRegistry;

    if (!request) {
      return (
        <PlaceholderRequestPane
          hotKeyRegistry={hotKeyRegistry}
          handleCreateRequest={handleCreateRequest}
        />
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
      <Pane type="request">
        <PaneHeader>
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
              hotKeyRegistry={settings.hotKeyRegistry}
              handleUpdateDownloadPath={handleUpdateDownloadPath}
              downloadPath={downloadPath}
            />
          </ErrorBoundary>
        </PaneHeader>
        <Tabs className={classnames(paneBodyClasses, 'react-tabs')} forceRenderTabPanel>
          <TabList>
            <Tab tabIndex="=1">
              <ContentTypeDropdown
                onChange={updateRequestMimeType}
                contentType={request.body.mimeType}
                request={request}
                className="tall"
              >
                {typeof request.body.mimeType === 'string'
                  ? getContentTypeName(request.body.mimeType)
                  : 'Body'}
                {numBodyParams ? <span className="bubble space-left">{numBodyParams}</span> : null}
                <i className="fa fa-caret-down space-left" />
              </ContentTypeDropdown>
            </Tab>
            <Tab tabIndex="=1">
              <AuthDropdown
                onChange={updateRequestAuthentication}
                request={request}
                className="tall"
              >
                {getAuthTypeName(request.authentication.type) || 'Auth'}
                <i className="fa fa-caret-down space-left" />
              </AuthDropdown>
            </Tab>
            <Tab tabIndex="=1">
              <button>
                Query
                {numParameters > 0 && <span className="bubble space-left">{numParameters}</span>}
              </button>
            </Tab>
            <Tab tabIndex="=1">
              <button>
                Header
                {numHeaders > 0 && <span className="bubble space-left">{numHeaders}</span>}
              </button>
            </Tab>
            <Tab tabIndex="=1">
              <button>
                Docs
                {request.description && (
                  <span className="bubble space-left">
                    <i className="fa fa--skinny fa-check txt-xxs" />
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
                  errorClassName="tall wide vertically-align font-error pad text-center"
                >
                  <RenderedQueryString handleRender={handleRender} request={request} />
                </ErrorBoundary>
              </code>
            </div>
            <div className="query-editor__editor">
              <ErrorBoundary
                key={uniqueKey}
                errorClassName="tall wide vertically-align font-error pad text-center"
              >
                <RequestParametersEditor
                  key={headerEditorKey}
                  handleRender={handleRender}
                  handleGetRenderContext={handleGetRenderContext}
                  nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
                  isVariableUncovered={isVariableUncovered}
                  editorFontSize={settings.editorFontSize}
                  editorIndentSize={settings.editorIndentSize}
                  editorLineWrapping={settings.editorLineWrapping}
                  onChange={updateRequestParameters}
                  request={request}
                  bulk={settings.useBulkParametersEditor}
                />
              </ErrorBoundary>
            </div>
            <div className="pad-right text-right">
              <button
                className="margin-top-sm btn btn--clicky"
                title={urlHasQueryParameters ? 'Import querystring' : 'No query params to import'}
                onClick={this._handleImportQueryFromUrl}
              >
                Import from URL
              </button>
              <button
                className="margin-top-sm btn btn--clicky space-left"
                onClick={this._handleUpdateSettingsUseBulkParametersEditor}
              >
                {settings.useBulkParametersEditor ? 'Regular Edit' : 'Bulk Edit'}
              </button>
            </div>
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel header-editor">
            <ErrorBoundary key={uniqueKey} errorClassName="font-error pad text-center">
              <RequestHeadersEditor
                key={headerEditorKey}
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
                onClick={this._handleUpdateSettingsUseBulkHeaderEditor}
              >
                {settings.useBulkHeaderEditor ? 'Regular Edit' : 'Bulk Edit'}
              </button>
            </div>
          </TabPanel>
          <TabPanel key={`docs::${uniqueKey}`} className="react-tabs__tab-panel tall scrollable">
            {request.description ? (
              <div>
                <div className="pull-right pad bg-default">
                  {/* @ts-expect-error -- TSCONVERSION the click handler expects a boolean prop... */}
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
                    <i
                      className="fa fa-file-text-o"
                      style={{
                        fontSize: '8rem',
                        opacity: 0.3,
                      }}
                    />
                  </span>
                  <br />
                  <br />
                  <button
                    className="btn btn--clicky faint"
                    onClick={this._handleEditDescriptionAdd}
                  >
                    Add Description
                  </button>
                </p>
              </div>
            )}
          </TabPanel>
        </Tabs>
      </Pane>
    );
  }
}
