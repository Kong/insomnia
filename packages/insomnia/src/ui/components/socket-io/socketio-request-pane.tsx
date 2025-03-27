import React, { type FC, Fragment } from 'react';
import { Button, Heading, Tab, TabList, TabPanel, Tabs, ToggleButton } from 'react-aria-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useParams, useRouteLoaderData } from 'react-router-dom';
import { useLocalStorage } from 'react-use';

import type { Environment } from '../../../models/environment';
import { getCombinedPathParametersFromUrl, type RequestPathParameter } from '../../../models/request';
import { deconstructQueryStringToParams, extractQueryStringFromUrl } from '../../../utils/url/querystring';
import { useRequestPatcher, useSettingsPatcher } from '../../hooks/use-request';
import { useActiveRequestSyncVCSVersion, useGitVCSVersion } from '../../hooks/use-vcs-version';
import type { SocketIORequestLoaderData } from '../../routes/request';
import { useRootLoaderData } from '../../routes/root';
import { OneLineEditor } from '../codemirror/one-line-editor';
import { readOnlyWebsocketPairs, RequestHeadersEditor } from '../editors/request-headers-editor';
import { RequestParametersEditor } from '../editors/request-parameters-editor';
import { ErrorBoundary } from '../error-boundary';
import { Icon } from '../icon';
import { MarkdownEditor } from '../markdown-editor';
import { Pane } from '../panes/pane';
import { RenderedQueryString } from '../rendered-query-string';
import { SocketIOActionBar } from './action-bar';
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
        This section is now locked since the connection has already been established. To change these settings, please disconnect first.
      </p>
    </div>
  );
};
interface Props {
  environment: Environment | null;
}

export const SocketIORequestPane: FC<Props> = ({ environment }) => {
  const { activeRequest, activeRequestMeta, requestPayload } = useRouteLoaderData('request/:requestId') as SocketIORequestLoaderData;

  const { requestId } = useParams() as { organizationId: string; projectId: string; workspaceId: string; requestId: string };

  const { settings } = useRootLoaderData();

  const [dismissPathParameterTip, setDismissPathParameterTip] = useLocalStorage('dismissPathParameterTip', '');

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
    const parameters = [
      ...activeRequest.parameters,
      ...deconstructQueryStringToParams(query),
    ];

    // Only update if url changed
    if (url !== activeRequest.url) {
      patchRequest(requestId, { url, parameters });
    }
  };

  const gitVersion = useGitVCSVersion();
  const activeRequestSyncVersion = useActiveRequestSyncVCSVersion();
  const patchRequest = useRequestPatcher();
  const urlHasQueryParameters = activeRequest.url.indexOf('?') >= 0;
  // Reset the response pane state when we switch requests, the environment gets modified, or the (Git|Sync)VCS version changes
  const uniqueKey = `${environment?.modified}::${requestId}::${gitVersion}::${activeRequestSyncVersion}::${activeRequestMeta.activeResponseId}`;

  // TODO: Implement readyState and disabled
  const disabled = false;
  const readyState = false;
  const eventsCount = 1;

  return (
    <Pane type="request">
      <header className="pane__header theme--pane__header !items-stretch">
        <SocketIOActionBar
          key={uniqueKey}
          request={activeRequest}
          environmentId={environment?._id || ''}
          defaultValue={activeRequest.url}
          readyState={readyState}
          onChange={url => patchRequest(requestId, { url })}
        />
      </header>
      <Tabs aria-label='SocketIO request pane tabs' className="flex-1 w-full h-full flex flex-col">
        <TabList className='w-full flex-shrink-0  overflow-x-auto border-solid scro border-b border-b-[--hl-md] bg-[--color-bg] flex items-center h-[--line-height-sm]' aria-label='Request pane tabs'>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='params'
          >
            <span>Params</span>
            {parametersCount > 0 && (
              <span className='p-1 min-w-6 h-6 flex items-center justify-center text-xs rounded-lg border border-solid border-[--hl]'>
                {parametersCount}
              </span>
            )}
          </Tab>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='body'
          >
            <span>Body</span>
            <span className='p-1 min-w-6 h-6 flex items-center justify-center text-xs rounded-lg border border-solid border-[--hl]'>
              <span className='w-2 h-2 bg-green-500 rounded-full' />
            </span>
          </Tab>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='events'
          >
            <span>Events</span>
            {eventsCount > 0 && (
              <span className='p-1 min-w-6 h-6 flex items-center justify-center text-xs rounded-lg border border-solid border-[--hl]'>
                {eventsCount}
              </span>
            )}
          </Tab>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='headers'
          >
            <span>Headers</span>
            {headersCount > 0 && (
              <span className='p-1 min-w-6 h-6 flex items-center justify-center text-xs rounded-lg border border-solid border-[--hl]'>
                {headersCount}
              </span>
            )}
          </Tab>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='docs'
          >
            Docs
          </Tab>
        </TabList>
        <TabPanel className='w-full flex-1 flex flex-col h-full overflow-y-auto' id='params'>
          {disabled && <PaneReadOnlyBanner />}

          <div className="p-4 flex-shrink-0">
            <div className="text-xs max-h-32 flex flex-col overflow-y-auto min-h-[2em] bg-[--hl-xs] px-2 py-1 border border-solid border-[--hl-sm]">
              <label className="label--small no-pad-top">Url Preview</label>
              <ErrorBoundary
                key={uniqueKey}
                errorClassName="tall wide vertically-align font-error pad text-center"
              >
                <RenderedQueryString request={activeRequest} />
              </ErrorBoundary>
            </div>
          </div>
          <PanelGroup className='flex-1 overflow-hidden' direction={'vertical'}>
            <Panel minSize={20}>
              <div className='h-full flex flex-col'>
                <div className='flex items-center w-full p-4 h-4 justify-between'>
                  <Heading className='text-xs font-bold uppercase text-[--hl]'>Query parameters</Heading>
                  <div className='flex items-center gap-2'>
                    <Button
                      isDisabled={disabled || !urlHasQueryParameters}
                      onPress={handleImportQueryFromUrl}
                      className="w-[14ch] flex flex-shrink-0 gap-2 items-center justify-start px-2 py-1 h-full asma-pressed:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-colors text-sm"
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
                      className="w-[14ch] flex flex-shrink-0 gap-2 items-center justify-start px-2 py-1 h-full rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-colors text-sm"
                    >
                      {({ isSelected }) => (
                        <Fragment>
                          <Icon icon={isSelected ? 'toggle-on' : 'toggle-off'} className={`${isSelected ? 'text-[--color-success]' : ''}`} />
                          <span>{
                            isSelected ? 'Regular Edit' : 'Bulk Edit'
                          }</span>
                        </Fragment>
                      )}
                    </ToggleButton>
                  </div>
                </div>
                <ErrorBoundary
                  key={uniqueKey}
                  errorClassName="tall wide vertically-align font-error pad text-center"
                >
                  <RequestParametersEditor
                    bulk={settings.useBulkParametersEditor}
                    disabled={disabled}
                  />
                </ErrorBoundary>
              </div>
            </Panel>
            <PanelResizeHandle className='w-full h-[1px] bg-[--hl-md]' />
            <Panel minSize={20}>
              <div className='h-full flex flex-col'>
                <Heading className='text-xs font-bold uppercase text-[--hl] p-4'>Path parameters</Heading>
                {pathParameters.length > 0 && (
                  <div className="pr-[72.73px] w-full overflow-y-auto pl-4">
                    <div className='grid gap-x-[20.8px] grid-cols-2 flex-shrink-0 w-full rounded-sm overflow-hidden'>
                      {pathParameters.map(pathParameter => (
                        <Fragment key={pathParameter.name}>
                          <span className='p-2 select-none border-b border-solid border-[--hl-md] truncate flex items-center justify-end rounded-sm'>
                            {pathParameter.name}
                          </span>
                          <div className='px-2 flex items-center h-full border-b border-solid border-[--hl-md]'>
                            <OneLineEditor
                              readOnly={disabled}
                              key={activeRequest._id}
                              id={'key-value-editor__name' + pathParameter.name}
                              placeholder="Parameter value"
                              defaultValue={pathParameter.value || ''}
                              onChange={name => {
                                onPathParameterChange(pathParameters.map(p => p.name === pathParameter.name ? { ...p, value: name } : p));
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
                  <div className='text-sm text-[--hl] rounded-sm border border-solid border-[--hl-md] p-2 flex items-center gap-2'>
                    <Icon icon='info-circle' />
                    <span>Path parameters are url path segments that start with a colon ':' e.g. ':id' </span>
                    <Button
                      className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] ml-auto"
                      onPress={() => setDismissPathParameterTip('true')}
                    >
                      <Icon icon='close' />
                    </Button>
                  </div>
                )}
              </div>
            </Panel>
          </PanelGroup>
        </TabPanel>
        <TabPanel className='w-full h-full flex-1 flex flex-col' id='body'>
          <SocketIOBodyTabPane
            request={activeRequest}
            requestPayload={requestPayload}
          />
        </TabPanel>
        <TabPanel className='w-full flex-1 overflow-y-auto' id='events'>
          <SocketIOEventTabPane />
        </TabPanel>
        <TabPanel className='w-full flex-1 overflow-y-auto' id='headers'>
          {disabled && <PaneReadOnlyBanner />}
          <RequestHeadersEditor
            key={uniqueKey}
            headers={activeRequest.headers}
            bulk={false}
            isDisabled={readyState}
            requestType="WebSocketRequest"
          />
        </TabPanel>
        <TabPanel className='w-full flex-1 overflow-y-auto' id='docs'>
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
