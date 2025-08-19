import React, { type FC, Fragment, useRef, useState } from 'react';
import { Button, Heading, Tab, TabList, TabPanel, Tabs, ToggleButton } from 'react-aria-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useParams } from 'react-router';
import * as reactUse from 'react-use';

import { OneLineEditor } from '~/ui/components/.client/codemirror/one-line-editor';

import { getContentTypeFromHeaders } from '../../../common/constants';
import * as models from '../../../models';
import { queryAllWorkspaceUrls } from '../../../models/helpers/query-all-workspace-urls';
import { getCombinedPathParametersFromUrl, type RequestParameter } from '../../../models/request';
import type { Settings } from '../../../models/settings';
import { getAuthObjectOrNull } from '../../../network/authentication';
import { useWorkspaceLoaderData } from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import {
  type RequestLoaderData,
  useRequestLoaderData,
} from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { deconstructQueryStringToParams, extractQueryStringFromUrl } from '../../../utils/url/querystring';
import { useRequestPatcher, useSettingsPatcher } from '../../hooks/use-request';
import { useActiveRequestSyncVCSVersion, useGitVCSVersion } from '../../hooks/use-vcs-version';
import { AuthWrapper } from '../editors/auth/auth-wrapper';
import { BodyEditor } from '../editors/body/body-editor';
import { readOnlyHttpPairs, RequestHeadersEditor } from '../editors/request-headers-editor';
import { RequestParametersEditor } from '../editors/request-parameters-editor';
import { RequestScriptEditor } from '../editors/request-script-editor';
import { ErrorBoundary } from '../error-boundary';
import { Icon } from '../icon';
import { MarkdownEditor } from '../markdown-editor';
import { RequestSettingsModal } from '../modals/request-settings-modal';
import { RenderedQueryString } from '../rendered-query-string';
import { RequestUrlBar, type RequestUrlBarHandle } from '../request-url-bar';
import { Pane, PaneHeader } from './pane';
import { PlaceholderRequestPane } from './placeholder-request-pane';

interface Props {
  environmentId: string;
  settings: Settings;
  onPaste: (text: string) => void;
}

export const RequestPane: FC<Props> = ({ environmentId, settings, onPaste }) => {
  const { activeRequest, activeRequestMeta } = useRequestLoaderData() as RequestLoaderData;
  const { workspaceId, requestId } = useParams() as { workspaceId: string; requestId: string };

  const patchSettings = useSettingsPatcher();
  const [isRequestSettingsModalOpen, setIsRequestSettingsModalOpen] = useState(false);
  const patchRequest = useRequestPatcher();

  const requestUrlBarRef = useRef<RequestUrlBarHandle>(null);
  const [dismissPathParameterTip, setDismissPathParameterTip] = reactUse.useLocalStorage('dismissPathParameterTip', '');
  const handleImportQueryFromUrl = () => {
    let query;

    try {
      query = extractQueryStringFromUrl(activeRequest.url);
    } catch (error) {
      console.warn('Failed to parse url to import querystring');
      return;
    }

    // Remove the search string (?foo=bar&...) from the Url
    const url = activeRequest.url.replace(`?${query}`, '');
    const parameters = [...activeRequest.parameters, ...deconstructQueryStringToParams(query)];

    // Only update if url changed
    if (url !== activeRequest.url) {
      patchRequest(requestId, { url, parameters });
      /**
       * Currently the OneLineEditor is a uncontrolled component, and the value is asynchronously, if we change the component to controlled, users need to wait for the value to be updated when inputting, that's not a good experience.
       * So as a workaround, we need to manually update the url bar value.
       */
      requestUrlBarRef.current?.setUrl(url);
    }
  };
  const gitVersion = useGitVCSVersion();
  const activeRequestSyncVersion = useActiveRequestSyncVCSVersion();

  const { activeEnvironment } = useWorkspaceLoaderData()!;
  // Force re-render when we switch requests, the environment gets modified, or the (Git|Sync)VCS version changes
  const uniqueKey = `${activeEnvironment?.modified}::${requestId}::${gitVersion}::${activeRequestSyncVersion}::${activeRequestMeta?.activeResponseId}`;

  if (!activeRequest) {
    return <PlaceholderRequestPane />;
  }
  const pathParameters = getCombinedPathParametersFromUrl(activeRequest.url, activeRequest.pathParameters || []);

  const onPathParameterChange = (pathParameters: RequestParameter[]) => {
    patchRequest(requestId, { pathParameters });
  };

  const parametersCount = pathParameters.length + activeRequest.parameters.filter(p => !p.disabled).length;
  const headersCount = activeRequest.headers.filter(h => !h.disabled).length + readOnlyHttpPairs.length;
  const urlHasQueryParameters = activeRequest.url.includes('?');
  const contentType = getContentTypeFromHeaders(activeRequest.headers) || activeRequest.body.mimeType;
  const isBodyEmpty = Boolean(typeof activeRequest.body.mimeType !== 'string' && !activeRequest.body.text);
  const requestAuth = getAuthObjectOrNull(activeRequest.authentication);
  const isNoneOrInherited = requestAuth?.type === 'none' || requestAuth === null;

  return (
    <Pane type="request">
      <PaneHeader>
        <ErrorBoundary errorClassName="font-error pad text-center">
          <RequestUrlBar
            key={requestId}
            uniquenessKey={uniqueKey}
            handleAutocompleteUrls={() => queryAllWorkspaceUrls(workspaceId, models.request.type, requestId)}
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
            onPaste={onPaste}
            ref={requestUrlBarRef}
          />
        </ErrorBoundary>
      </PaneHeader>
      <Tabs aria-label="Request pane tabs" className="flex h-full w-full flex-1 flex-col">
        <TabList
          className="scrollbar-thin flex h-[--line-height-sm] w-full flex-shrink-0 items-center overflow-x-auto border-b border-solid border-b-[--hl-md] bg-[--color-bg]"
          aria-label="Request pane tabs"
        >
          <Tab
            className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
            id="params"
          >
            <span>Params</span>
            {parametersCount > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-[--hl] p-1 text-xs">
                {parametersCount}
              </span>
            )}
          </Tab>
          <Tab
            className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
            id="content-type"
          >
            <span>Body</span>
            {!isBodyEmpty && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-[--hl] p-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-green-500" />
              </span>
            )}
          </Tab>
          <Tab
            className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
            id="auth"
          >
            <span>Auth</span>

            {!isNoneOrInherited && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-[--hl] p-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-green-500" />
              </span>
            )}
          </Tab>
          <Tab
            className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
            id="headers"
          >
            <span>Headers</span>
            {headersCount > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-[--hl] p-1 text-xs">
                {headersCount}
              </span>
            )}
          </Tab>
          <Tab
            className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
            id="scripts"
          >
            <span>Scripts</span>
            {Boolean(activeRequest.preRequestScript || activeRequest.afterResponseScript) && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-[--hl] p-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-green-500" />
              </span>
            )}
          </Tab>
          <Tab
            className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
            id="docs"
          >
            <span>Docs</span>
            {activeRequest.description && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-[--hl] p-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-green-500" />
              </span>
            )}
          </Tab>
        </TabList>
        <TabPanel className="flex h-full w-full flex-1 flex-col overflow-y-auto" id="params">
          <div className="flex-shrink-0 p-4">
            <div className="flex max-h-32 min-h-[2em] flex-col overflow-y-auto border border-solid border-[--hl-sm] bg-[--hl-xs] px-2 py-1 text-xs">
              <label className="label--small no-pad-top">Url Preview</label>
              <ErrorBoundary key={uniqueKey} errorClassName="tall wide vertically-align font-error pad text-center">
                <RenderedQueryString request={activeRequest} />
              </ErrorBoundary>
            </div>
          </div>
          <PanelGroup className="flex-1 overflow-hidden" direction={'vertical'}>
            <Panel minSize={20}>
              <div className="flex h-full flex-col">
                <div className="flex h-4 w-full items-center justify-between p-4">
                  <Heading className="text-xs font-bold uppercase text-[--hl]">Query parameters</Heading>
                  <div className="flex items-center gap-2">
                    <Button
                      isDisabled={!urlHasQueryParameters}
                      onPress={handleImportQueryFromUrl}
                      className="asma-pressed:bg-[--hl-sm] flex h-full w-[14ch] flex-shrink-0 items-center justify-start gap-2 rounded-sm px-2 py-1 text-sm text-[--color-font] ring-1 ring-transparent transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] focus:ring-inset focus:ring-[--hl-md] aria-selected:bg-[--hl-xs] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
                    >
                      Import from URL
                    </Button>
                    <ToggleButton
                      onChange={isSelected => {
                        patchSettings({
                          useBulkParametersEditor: isSelected,
                        });
                      }}
                      isSelected={settings.useBulkParametersEditor}
                      className="flex h-full w-[14ch] flex-shrink-0 items-center justify-start gap-2 rounded-sm px-2 py-1 text-sm text-[--color-font] ring-1 ring-transparent transition-colors hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md]"
                    >
                      {({ isSelected }) => (
                        <Fragment>
                          <Icon
                            icon={isSelected ? 'toggle-on' : 'toggle-off'}
                            className={`${isSelected ? 'text-[--color-success]' : ''}`}
                          />
                          <span>{isSelected ? 'Regular Edit' : 'Bulk Edit'}</span>
                        </Fragment>
                      )}
                    </ToggleButton>
                  </div>
                </div>
                <ErrorBoundary key={uniqueKey} errorClassName="tall wide vertically-align font-error pad text-center">
                  <RequestParametersEditor key={contentType} bulk={settings.useBulkParametersEditor} />
                </ErrorBoundary>
              </div>
            </Panel>
            <PanelResizeHandle className="h-[1px] w-full bg-[--hl-md]" />
            <Panel minSize={20}>
              <div className="flex h-full flex-col">
                <Heading className="p-4 text-xs font-bold uppercase text-[--hl]">Path parameters</Heading>
                {pathParameters.length > 0 && (
                  <div className="w-full overflow-y-auto pl-4 pr-[72.73px]">
                    <div className="grid w-full flex-shrink-0 grid-cols-2 gap-x-[20.8px] overflow-hidden rounded-sm">
                      {pathParameters.map(pathParameter => (
                        <Fragment key={pathParameter.name}>
                          <span className="flex select-none items-center justify-end truncate rounded-sm border-b border-solid border-[--hl-md] p-2">
                            {pathParameter.name}
                          </span>
                          <div className="flex h-full items-center border-b border-solid border-[--hl-md] px-2">
                            <OneLineEditor
                              key={activeRequest._id}
                              id={'key-value-editor__name' + pathParameter.name}
                              placeholder="Parameter value"
                              defaultValue={pathParameter.value || ''}
                              onChange={name => {
                                onPathParameterChange(
                                  pathParameters.map(p => (p.name === pathParameter.name ? { ...p, value: name } : p)),
                                );
                              }}
                            />
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                )}
                {pathParameters.length === 0 && !dismissPathParameterTip && (
                  <div className="flex items-center gap-2 rounded-sm border border-solid border-[--hl-md] p-2 text-sm text-[--hl]">
                    <Icon icon="info-circle" />
                    <span>Path parameters are url path segments that start with a colon ':' e.g. ':id' </span>
                    <Button
                      className="ml-auto flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-[--color-font] hover:bg-[--hl-xs] aria-pressed:bg-[--hl-sm]"
                      onPress={() => setDismissPathParameterTip('true')}
                    >
                      <Icon icon="close" />
                    </Button>
                  </div>
                )}
              </div>
            </Panel>
          </PanelGroup>
        </TabPanel>
        <TabPanel className="flex w-full flex-1 flex-col" id="content-type">
          <BodyEditor key={uniqueKey} request={activeRequest} environmentId={environmentId} />
        </TabPanel>
        <TabPanel className="flex w-full flex-1 flex-col overflow-hidden" id="auth">
          <ErrorBoundary key={uniqueKey} errorClassName="font-error pad text-center">
            <AuthWrapper authentication={activeRequest.authentication} />
          </ErrorBoundary>
        </TabPanel>
        <TabPanel className="relative flex w-full flex-1 flex-col overflow-hidden" id="headers">
          <ErrorBoundary key={uniqueKey} errorClassName="font-error pad text-center">
            <div className="flex-1 flex-shrink-0 overflow-y-auto">
              <RequestHeadersEditor
                bulk={settings.useBulkHeaderEditor}
                headers={activeRequest.headers}
                requestType="Request"
              />
            </div>
          </ErrorBoundary>

          <div className="box-border flex h-[var(--line-height-sm)] flex-row border-t border-solid border-[var(--hl-md)] text-[var(--font-size-sm)]">
            <Button
              className="flex h-full items-center justify-center gap-2 px-4 py-1 text-xs text-[--color-font] ring-1 ring-transparent transition-colors hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
              onPress={() =>
                patchSettings({
                  useBulkHeaderEditor: !settings.useBulkHeaderEditor,
                })
              }
            >
              {settings.useBulkHeaderEditor ? 'Regular Edit' : 'Bulk Edit'}
            </Button>
          </div>
        </TabPanel>
        <TabPanel className="w-full flex-1" id="scripts">
          <Tabs className="flex h-full w-full flex-col overflow-hidden">
            <TabList
              className="flex h-[--line-height-sm] w-full flex-shrink-0 items-center gap-2 overflow-x-auto border-b border-solid border-b-[--hl-md] bg-[--color-bg] px-2"
              aria-label="Request scripts tabs"
            >
              <Tab
                className="flex h-[--line-height-xxs] w-[10.5rem] flex-shrink-0 cursor-pointer select-none items-center justify-between rounded-md px-2 py-1 text-sm text-[--hl] outline-none transition-colors duration-300 hover:bg-[rgba(var(--color-surprise-rgb),50%)] hover:text-[--color-font-surprise] aria-selected:bg-[rgba(var(--color-surprise-rgb),40%)] aria-selected:text-[--color-font-surprise]"
                id="pre-request"
              >
                <div className="flex flex-1 items-center gap-2">
                  <Icon icon="arrow-right-to-bracket" />
                  <span>Pre-request</span>
                </div>
                {Boolean(activeRequest.preRequestScript) && (
                  <span className="rounded-lg p-2">
                    <span className="flex h-2 w-2 rounded-full bg-green-500" />
                  </span>
                )}
              </Tab>
              <Tab
                className="flex h-[--line-height-xxs] w-[10.5rem] flex-shrink-0 cursor-pointer select-none items-center justify-between rounded-md px-2 py-1 text-sm text-[--hl] outline-none transition-colors duration-300 hover:bg-[rgba(var(--color-surprise-rgb),50%)] hover:text-[--color-font-surprise] aria-selected:bg-[rgba(var(--color-surprise-rgb),40%)] aria-selected:text-[--color-font-surprise]"
                id="after-response"
              >
                <div className="flex flex-1 items-center gap-2">
                  <Icon icon="arrow-right-from-bracket" />
                  <span>After-response</span>
                </div>
                {Boolean(activeRequest.afterResponseScript) && (
                  <span className="rounded-lg p-2">
                    <span className="flex h-2 w-2 rounded-full bg-green-500" />
                  </span>
                )}
              </Tab>
            </TabList>
            <TabPanel className="w-full flex-1" id="pre-request">
              <ErrorBoundary key={uniqueKey} errorClassName="tall wide vertically-align font-error pad text-center">
                <RequestScriptEditor
                  uniquenessKey={`${activeRequest._id}:pre-request-script`}
                  defaultValue={activeRequest.preRequestScript || ''}
                  onChange={preRequestScript => patchRequest(requestId, { preRequestScript })}
                  settings={settings}
                />
              </ErrorBoundary>
            </TabPanel>
            <TabPanel className="w-full flex-1" id="after-response">
              <ErrorBoundary key={uniqueKey} errorClassName="tall wide vertically-align font-error pad text-center">
                <RequestScriptEditor
                  uniquenessKey={`${activeRequest._id}:after-response-script`}
                  defaultValue={activeRequest.afterResponseScript || ''}
                  onChange={afterResponseScript => patchRequest(requestId, { afterResponseScript })}
                  settings={settings}
                />
              </ErrorBoundary>
            </TabPanel>
          </Tabs>
        </TabPanel>
        <TabPanel className="w-full flex-1 overflow-y-auto" id="docs">
          <MarkdownEditor
            key={uniqueKey}
            placeholder="Write a description"
            defaultValue={activeRequest.description}
            onChange={(description: string) => patchRequest(requestId, { description })}
          />
        </TabPanel>
      </Tabs>
      {isRequestSettingsModalOpen && (
        <RequestSettingsModal request={activeRequest} onHide={() => setIsRequestSettingsModalOpen(false)} />
      )}
    </Pane>
  );
};
