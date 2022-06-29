import classnames from 'classnames';
import { deconstructQueryStringToParams, extractQueryStringFromUrl } from 'insomnia-url';
import React, { FC, useCallback, useEffect, useRef } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import { useMount } from 'react-use';

import * as models from '../../../models';
import { queryAllWorkspaceUrls } from '../../../models/helpers/query-all-workspace-urls';
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
  downloadPath: string | null;
  environmentId: string;
  forceRefreshCounter: number;
  forceUpdateRequest: (r: Request, patch: Partial<Request>) => Promise<Request>;
  forceUpdateRequestHeaders: (r: Request, headers: RequestHeader[]) => Promise<Request>;
  handleGenerateCode: Function;
  handleImport: Function;
  handleSend: () => void;
  handleSendAndDownload: (filepath?: string) => Promise<void>;
  handleUpdateDownloadPath: Function;
  headerEditorKey: string;
  request?: Request | null;
  settings: Settings;
  updateRequestAuthentication: (r: Request, auth: RequestAuthentication) => Promise<Request>;
  updateRequestBody: (r: Request, body: RequestBody) => Promise<Request>;
  updateRequestHeaders: (r: Request, headers: RequestHeader[]) => Promise<Request>;
  updateRequestMethod: (r: Request, method: string) => Promise<Request>;
  updateRequestMimeType: (mimeType: string | null) => Promise<Request | null>;
  updateRequestParameters: (r: Request, params: RequestParameter[]) => Promise<Request>;
  updateRequestUrl: (r: Request, url: string) => Promise<Request>;
  updateSettingsUseBulkHeaderEditor: Function;
  updateSettingsUseBulkParametersEditor: (useBulkParametersEditor: boolean) => Promise<Settings>;
  workspace: Workspace;
}

export const RequestPane: FC<Props> = ({
  downloadPath,
  environmentId,
  forceRefreshCounter,
  forceUpdateRequest,
  forceUpdateRequestHeaders,
  handleGenerateCode,
  handleImport,
  handleSend,
  handleSendAndDownload,
  handleUpdateDownloadPath,
  headerEditorKey,
  request,
  settings,
  updateRequestAuthentication,
  updateRequestBody,
  updateRequestHeaders,
  updateRequestMethod,
  updateRequestMimeType,
  updateRequestParameters,
  updateRequestUrl,
  updateSettingsUseBulkHeaderEditor,
  updateSettingsUseBulkParametersEditor,
  workspace,
}) => {
  const handleEditDescription = useCallback((forceEditMode: boolean) => {
    showModal(RequestSettingsModal, { request, forceEditMode });
  }, [request]);

  const handleEditDescriptionAdd = useCallback(() => {
    handleEditDescription(true);
  }, [handleEditDescription]);

  const autocompleteUrls = useCallback(() => {
    return queryAllWorkspaceUrls(workspace, models.request.type, request?._id);
  }, [workspace, request]);

  const handleUpdateSettingsUseBulkHeaderEditor = useCallback(() => {
    updateSettingsUseBulkHeaderEditor(!settings.useBulkHeaderEditor);
  }, [settings, updateSettingsUseBulkHeaderEditor]);

  const handleUpdateSettingsUseBulkParametersEditor = useCallback(() => {
    updateSettingsUseBulkParametersEditor(!settings.useBulkParametersEditor);
  }, [settings, updateSettingsUseBulkParametersEditor]);

  const handleImportQueryFromUrl = useCallback(() => {
    if (!request) {
      console.warn('Tried to import query when no request active');
      return;
    }

    let query;

    try {
      query = extractQueryStringFromUrl(request.url);
    } catch (error) {
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
  }, [request, forceUpdateRequest]);

  const requestUrlBarRef = useRef<RequestUrlBar>(null);
  useMount(() => {
    requestUrlBarRef.current?.focusInput();
  });
  useEffect(() => {
    requestUrlBarRef.current?.focusInput();
  }, [
    request?._id, // happens when the user switches requests
    settings.hasPromptedAnalytics, // happens when the user dismisses the analytics modal
  ]);

  if (!request) {
    return (
      <PlaceholderRequestPane />
    );
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
            ref={requestUrlBarRef}
            uniquenessKey={uniqueKey}
            onMethodChange={updateRequestMethod}
            onUrlChange={updateRequestUrl}
            handleAutocompleteUrls={autocompleteUrls}
            handleImport={handleImport}
            handleGenerateCode={handleGenerateCode}
            handleSend={handleSend}
            handleSendAndDownload={handleSendAndDownload}
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
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
            />
          </Tab>
          <Tab tabIndex="=1">
            <AuthDropdown
              onChange={updateRequestAuthentication}
            />
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
            request={request}
            workspace={workspace}
            environmentId={environmentId}
            settings={settings}
            onChange={updateRequestBody}
            onChangeHeaders={forceUpdateRequestHeaders}
          />
        </TabPanel>
        <TabPanel className="react-tabs__tab-panel scrollable-container">
          <div className="scrollable">
            <ErrorBoundary key={uniqueKey} errorClassName="font-error pad text-center">
              <AuthWrapper />
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
                <RenderedQueryString request={request} />
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
              onClick={handleImportQueryFromUrl}
            >
              Import from URL
            </button>
            <button
              className="margin-top-sm btn btn--clicky space-left"
              onClick={handleUpdateSettingsUseBulkParametersEditor}
            >
              {settings.useBulkParametersEditor ? 'Regular Edit' : 'Bulk Edit'}
            </button>
          </div>
        </TabPanel>
        <TabPanel className="react-tabs__tab-panel header-editor">
          <ErrorBoundary key={uniqueKey} errorClassName="font-error pad text-center">
            <RequestHeadersEditor
              key={headerEditorKey}
              onChange={updateRequestHeaders}
              request={request}
              bulk={settings.useBulkHeaderEditor}
            />
          </ErrorBoundary>

          <div className="pad-right text-right">
            <button
              className="margin-top-sm btn btn--clicky"
              onClick={handleUpdateSettingsUseBulkHeaderEditor}
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
                <button className="btn btn--clicky" onClick={handleEditDescription}>
                  Edit
                </button>
              </div>
              <div className="pad">
                <ErrorBoundary errorClassName="font-error pad text-center">
                  <MarkdownPreview
                    heading={request.name}
                    debounceMillis={1000}
                    markdown={request.description}
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
                  onClick={handleEditDescriptionAdd}
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
};
