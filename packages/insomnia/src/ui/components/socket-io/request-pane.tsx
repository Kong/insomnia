import React, { type FC, Fragment } from 'react';
import { Button, Heading, Tab, TabList, TabPanel, Tabs, ToggleButton } from 'react-aria-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useParams } from 'react-router';
import * as reactUse from 'react-use';

import { getAuthObjectOrNull } from '~/network/authentication';
import { useRootLoaderData } from '~/root';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { OneLineEditor } from '~/ui/components/.client/codemirror/one-line-editor';
import { AuthWrapper } from '~/ui/components/editors/auth/auth-wrapper';

import type { Environment } from '../../../models/environment';
import { getCombinedPathParametersFromUrl, type RequestPathParameter } from '../../../models/request';
import {
  type SocketIORequestLoaderData,
  useRequestLoaderData,
} from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { deconstructQueryStringToParams, extractQueryStringFromUrl } from '../../../utils/url/querystring';
import { useReadyState } from '../../hooks/use-ready-state';
import { useRequestPatcher, useSettingsPatcher } from '../../hooks/use-request';
import { useGitVCSVersion } from '../../hooks/use-vcs-version';
import { readOnlyWebsocketPairs, RequestHeadersEditor } from '../editors/request-headers-editor';
import { RequestParametersEditor } from '../editors/request-parameters-editor';
import { ErrorBoundary } from '../error-boundary';
import { Icon } from '../icon';
import { MarkdownEditor } from '../markdown-editor';
import { Pane } from '../panes/pane';
import { RenderedQueryString } from '../rendered-query-string';
import { WebSocketActionBar } from '../websockets/action-bar';
import { SocketIOBodyTabPane } from './body-tab-pane';
import { SocketIOEventTabPane } from './event-tab-pane';

// TODO: extract to a separate file as common component
const PaneReadOnlyBanner = () => {
  return (
    <div
      style={{
        paddingTop: 'var(--padding-md)',
        paddingLeft: 'var(--padding-md)',
        paddingRight: 'var(--padding-md)',
      }}
    >
      <p className="notice info no-margin-top no-margin-bottom">
        This section is now locked since the connection has already been established. To change these settings, please
        disconnect first.
      </p>
    </div>
  );
};
interface Props {
  environment: Environment | null;
}

export const SocketIORequestPane: FC<Props> = ({ environment }) => {
  const { activeRequest, activeRequestMeta, requestPayload } = useRequestLoaderData() as SocketIORequestLoaderData;
  const { vcsVersion } = useWorkspaceLoaderData()!;
  const { requestId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    requestId: string;
  };

  const { settings } = useRootLoaderData()!;

  const [dismissPathParameterTip, setDismissPathParameterTip] = reactUse.useLocalStorage('dismissPathParameterTip', '');

  // Path parameters are path segments that start with a colon (:)
  const pathParameters = getCombinedPathParametersFromUrl(activeRequest.url, activeRequest.pathParameters || []);

  const onPathParameterChange = (pathParameters: RequestPathParameter[]) => {
    patchRequest(requestId, { pathParameters });
  };

  const parametersCount = pathParameters.length + activeRequest.parameters.filter(p => !p.disabled).length;
  const headersCount = activeRequest.headers.filter(h => !h.disabled).length + readOnlyWebsocketPairs.length;
  const patchSettings = useSettingsPatcher();

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
    }
  };

  const gitVersion = useGitVCSVersion();
  const patchRequest = useRequestPatcher();
  const urlHasQueryParameters = activeRequest.url.includes('?');
  // Reset the response pane state when we switch requests, the environment gets modified, or the (Git|Sync)VCS version changes
  const uniqueKey = `${environment?.modified}::${requestId}::${gitVersion}::${vcsVersion}::${activeRequestMeta.activeResponseId}`;

  const readyState = useReadyState({ requestId: activeRequest._id, protocol: 'socketIO' });
  const disabled = readyState;
  const eventsCount = activeRequest?.eventListeners?.length || 0;

  const requestAuth = getAuthObjectOrNull(activeRequest.authentication);
  const isAuthEnable = requestAuth?.type === 'singleToken' && !requestAuth.disabled;

  return (
    <Pane type="request">
      <header className="pane__header theme--pane__header !items-stretch">
        <WebSocketActionBar
          key={uniqueKey}
          request={activeRequest}
          environmentId={environment?._id || ''}
          defaultValue={activeRequest.url}
          readyState={readyState}
          onChange={url => patchRequest(requestId, { url })}
        />
      </header>
      <Tabs aria-label="SocketIO request pane tabs" className="flex h-full w-full flex-1 flex-col">
        <TabList
          className="scro flex h-[--line-height-sm] w-full flex-shrink-0 items-center overflow-x-auto border-b border-solid border-b-[--hl-md] bg-[--color-bg]"
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
            id="body"
          >
            <span>Body</span>
            <span className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-[--hl] p-1 text-xs">
              <span className="h-2 w-2 rounded-full bg-green-500" />
            </span>
          </Tab>
          <Tab
            className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
            id="events"
          >
            <span>Events</span>
            {eventsCount > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-[--hl] p-1 text-xs">
                {eventsCount}
              </span>
            )}
          </Tab>
          <Tab
            className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
            id="auth"
          >
            <span>Auth</span>
            {isAuthEnable && (
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
            id="docs"
          >
            Docs
          </Tab>
        </TabList>
        <TabPanel className="flex h-full w-full flex-1 flex-col overflow-y-auto" id="params">
          {disabled && <PaneReadOnlyBanner />}

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
                      isDisabled={disabled || !urlHasQueryParameters}
                      onPress={handleImportQueryFromUrl}
                      className="asma-pressed:bg-[--hl-sm] flex h-full w-[14ch] flex-shrink-0 items-center justify-start gap-2 rounded-sm px-2 py-1 text-sm text-[--color-font] ring-1 ring-transparent transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] focus:ring-inset focus:ring-[--hl-md] aria-selected:bg-[--hl-xs] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
                    >
                      Import from URL
                    </Button>
                    <ToggleButton
                      isDisabled={disabled}
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
                  <RequestParametersEditor bulk={settings.useBulkParametersEditor} disabled={disabled} />
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
                              readOnly={disabled}
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
                {/* TODO: extract this as a common component */}
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
        <TabPanel className="flex h-full w-full flex-1 flex-col" id="body">
          <SocketIOBodyTabPane
            request={activeRequest}
            requestPayload={requestPayload}
            environmentId={environment?._id || ''}
          />
        </TabPanel>
        <TabPanel className="w-full flex-1 overflow-y-auto" id="events">
          <SocketIOEventTabPane request={activeRequest} eventListeners={activeRequest.eventListeners} />
        </TabPanel>
        <TabPanel className="w-full flex-1 overflow-y-auto" id="auth">
          <AuthWrapper
            key={uniqueKey}
            authentication={activeRequest.authentication}
            disabled={readyState}
            authTypes={['singleToken']}
            hideOthers
          />
        </TabPanel>
        <TabPanel className="w-full flex-1 overflow-y-auto" id="headers">
          {disabled && <PaneReadOnlyBanner />}
          <RequestHeadersEditor
            key={uniqueKey}
            headers={activeRequest.headers}
            bulk={false}
            isDisabled={readyState}
            requestType="WebSocketRequest"
          />
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
    </Pane>
  );
};
