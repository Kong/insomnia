import React, { FC, Fragment, useState } from 'react';
import { Button, Heading, Tab, TabList, TabPanel, Tabs, ToggleButton } from 'react-aria-components';
import { useParams, useRouteLoaderData } from 'react-router-dom';
import { useLocalStorage } from 'react-use';

import { getContentTypeFromHeaders } from '../../../common/constants';
import * as models from '../../../models';
import { queryAllWorkspaceUrls } from '../../../models/helpers/query-all-workspace-urls';
import { getCombinedPathParametersFromUrl, RequestParameter } from '../../../models/request';
import type { Settings } from '../../../models/settings';
import { deconstructQueryStringToParams, extractQueryStringFromUrl } from '../../../utils/url/querystring';
import { useRequestPatcher, useSettingsPatcher } from '../../hooks/use-request';
import { useActiveRequestSyncVCSVersion, useGitVCSVersion } from '../../hooks/use-vcs-version';
import { RequestLoaderData } from '../../routes/request';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { OneLineEditor } from '../codemirror/one-line-editor';
import { AuthWrapper } from '../editors/auth/auth-wrapper';
import { BodyEditor } from '../editors/body/body-editor';
import { readOnlyHttpPairs, RequestHeadersEditor } from '../editors/request-headers-editor';
import { RequestParametersEditor } from '../editors/request-parameters-editor';
import { RequestScriptEditor } from '../editors/request-script-editor';
import { ErrorBoundary } from '../error-boundary';
import { Icon } from '../icon';
import { MarkdownPreview } from '../markdown-preview';
import { RequestSettingsModal } from '../modals/request-settings-modal';
import { RenderedQueryString } from '../rendered-query-string';
import { RequestUrlBar } from '../request-url-bar';
import { Pane, PaneHeader } from './pane';
import { PlaceholderRequestPane } from './placeholder-request-pane';

interface Props {
  environmentId: string;
  settings: Settings;
  setLoading: (l: boolean) => void;
  onPaste: (text: string) => void;
}

export const RequestPane: FC<Props> = ({
  environmentId,
  settings,
  setLoading,
  onPaste,
}) => {
  const { activeRequest, activeRequestMeta } = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const { workspaceId, requestId } = useParams() as { organizationId: string; projectId: string; workspaceId: string; requestId: string };
  const patchSettings = useSettingsPatcher();
  const [isRequestSettingsModalOpen, setIsRequestSettingsModalOpen] = useState(false);
  const patchRequest = useRequestPatcher();

  const [dismissPathParameterTip, setDismissPathParameterTip] = useLocalStorage('dismissPathParameterTip', '');
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

  const { activeEnvironment } = useRouteLoaderData(
    ':workspaceId',
  ) as WorkspaceLoaderData;
  // Force re-render when we switch requests, the environment gets modified, or the (Git|Sync)VCS version changes
  const uniqueKey = `${activeEnvironment?.modified}::${requestId}::${gitVersion}::${activeRequestSyncVersion}::${activeRequestMeta?.activeResponseId}`;

  if (!activeRequest) {
    return <PlaceholderRequestPane />;
  }
  const pathParameters = getCombinedPathParametersFromUrl(activeRequest.url, activeRequest.pathParameters);

  const onPathParameterChange = (pathParameters: RequestParameter[]) => {
    patchRequest(requestId, { pathParameters });
  };

  const parametersCount = pathParameters.length + activeRequest.parameters.filter(p => !p.disabled).length;
  const headersCount = activeRequest.headers.filter(h => !h.disabled).length + readOnlyHttpPairs.length;
  const urlHasQueryParameters = activeRequest.url.indexOf('?') >= 0;
  const contentType =
    getContentTypeFromHeaders(activeRequest.headers) ||
    activeRequest.body.mimeType;

  return (
    <Pane type="request">
      <PaneHeader>
        <ErrorBoundary errorClassName="font-error pad text-center">
          <RequestUrlBar
            key={requestId}
            uniquenessKey={uniqueKey}
            handleAutocompleteUrls={() => queryAllWorkspaceUrls(workspaceId, models.request.type, requestId)}
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
            setLoading={setLoading}
            onPaste={onPaste}
          />
        </ErrorBoundary>
      </PaneHeader>
      <Tabs aria-label='Request pane tabs' className="flex-1 w-full h-full flex flex-col">
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
            id='content-type'
          >
            <span>Body</span>
          </Tab>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='auth'
          >
            <span>Auth</span>
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
            id='scripts'
          >
            <span>Scripts</span>
            {Boolean(activeRequest.preRequestScript || activeRequest.afterResponseScript) && (
              <span className='p-1 min-w-6 h-6 flex items-center justify-center text-xs rounded-lg border border-solid border-[--hl]'>
                <span className='w-2 h-2 bg-green-500 rounded-full' />
              </span>
            )}
          </Tab>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='docs'
          >
            <span>Docs</span>
            {activeRequest.description && (
              <span className='p-1 min-w-6 h-6 flex items-center justify-center text-xs rounded-lg border border-solid border-[--hl]'>
                <span className='w-2 h-2 bg-green-500 rounded-full' />
              </span>
            )}
          </Tab>
        </TabList>
        <TabPanel className='w-full flex-1 flex flex-col h-full overflow-y-auto' id='params'>
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
          <div className="flex-shrink-0 grid flex-1 [grid-template-rows:minmax(auto,min-content)] [grid-template-columns:100%] overflow-hidden">
            <div className="min-h-[2rem] max-h-full flex flex-col overflow-y-auto [&_.key-value-editor]:p-0 flex-1">
              <div className='flex items-center w-full p-4 h-4 justify-between'>
                <Heading className='text-xs font-bold uppercase text-[--hl]'>Query parameters</Heading>
                <div className='flex items-center gap-2'>
                  <Button
                    isDisabled={!urlHasQueryParameters}
                    onPress={handleImportQueryFromUrl}
                    className="w-[14ch] flex flex-shrink-0 gap-2 items-center justify-start px-2 py-1 h-full asma-pressed:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-colors text-sm"
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
                  key={contentType}
                  bulk={settings.useBulkParametersEditor}
                />
              </ErrorBoundary>
            </div>
            <div className='flex-1 flex flex-col gap-4 p-4 overflow-y-auto'>
              <Heading className='text-xs font-bold uppercase text-[--hl]'>Path parameters</Heading>
              {pathParameters.length > 0 && (
                <div className="pr-[72.73px] w-full">
                  <div className='grid gap-x-[20.8px] grid-cols-2 flex-shrink-0 w-full rounded-sm overflow-hidden'>
                    {pathParameters.map(pathParameter => (
                      <Fragment key={pathParameter.name}>
                        <span className='p-2 select-none border-b border-solid border-[--hl-md] truncate flex items-center justify-end rounded-sm'>
                          {pathParameter.name}
                        </span>
                        <div className='px-2 flex items-center h-full border-b border-solid border-[--hl-md]'>
                          <OneLineEditor
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
          </div>
        </TabPanel>
        <TabPanel className='w-full flex-1 flex flex-col' id='content-type'>
          <BodyEditor
            key={uniqueKey}
            request={activeRequest}
            environmentId={environmentId}
          />
        </TabPanel>
        <TabPanel className='w-full flex-1 flex flex-col overflow-hidden' id='auth'>
          <ErrorBoundary
            key={uniqueKey}
            errorClassName="font-error pad text-center"
          >
            <AuthWrapper authentication={activeRequest.authentication} />
          </ErrorBoundary>
        </TabPanel>
        <TabPanel className='w-full flex-1 flex flex-col relative overflow-hidden' id='headers'>
          <ErrorBoundary
            key={uniqueKey}
            errorClassName="font-error pad text-center"
          >
            <div className='overflow-y-auto flex-1 flex-shrink-0'>
              <RequestHeadersEditor
                bulk={settings.useBulkHeaderEditor}
                headers={activeRequest.headers}
                requestType="Request"
              />
            </div>
          </ErrorBoundary>

          <div className="flex flex-row border-solid border-t border-[var(--hl-md)] h-[var(--line-height-sm)] text-[var(--font-size-sm)] box-border">
            <Button
              className="px-4 py-1 h-full flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] text-xs hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-colors"
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
        <TabPanel className='w-full flex-1' id='scripts'>
          <Tabs className="w-full h-full flex flex-col overflow-hidden">
            <TabList className="w-full flex-shrink-0 overflow-x-auto border-solid border-b border-b-[--hl-md] px-2 bg-[--color-bg] flex items-center gap-2 h-[--line-height-sm]" aria-label="Request scripts tabs">
              <Tab
                className="rounded-md flex-shrink-0 h-[--line-height-xxs] text-sm flex items-center justify-between cursor-pointer w-[10.5rem] outline-none select-none px-2 py-1 hover:bg-[rgba(var(--color-surprise-rgb),50%)] text-[--hl] aria-selected:text-[--color-font-surprise] hover:text-[--color-font-surprise] aria-selected:bg-[rgba(var(--color-surprise-rgb),40%)] transition-colors duration-300"
                id="pre-request"
              >
                <div className='flex flex-1 items-center gap-2'>
                  <Icon icon="arrow-right-to-bracket" />
                  <span>Pre-request</span>
                </div>
                {Boolean(activeRequest.preRequestScript) && (
                  <span className="p-2 rounded-lg">
                    <span className="flex w-2 h-2 bg-green-500 rounded-full" />
                  </span>
                )}
              </Tab>
              <Tab
                className="rounded-md flex-shrink-0 h-[--line-height-xxs] text-sm flex items-center justify-between cursor-pointer w-[10.5rem] outline-none select-none px-2 py-1 hover:bg-[rgba(var(--color-surprise-rgb),50%)] text-[--hl] aria-selected:text-[--color-font-surprise] hover:text-[--color-font-surprise] aria-selected:bg-[rgba(var(--color-surprise-rgb),40%)] transition-colors duration-300"
                id="after-response"
              >
                <div className='flex flex-1 items-center gap-2'>
                  <Icon icon="arrow-right-from-bracket" />
                  <span>After-response</span>
                </div>
                {Boolean(activeRequest.afterResponseScript) && (
                  <span className="p-2 rounded-lg">
                    <span className="flex w-2 h-2 bg-green-500 rounded-full" />
                  </span>
                )}
              </Tab>
            </TabList>
            <TabPanel className="w-full flex-1" id='pre-request'>
              <ErrorBoundary
                key={uniqueKey}
                errorClassName="tall wide vertically-align font-error pad text-center"
              >
                <RequestScriptEditor
                  uniquenessKey={uniqueKey}
                  defaultValue={activeRequest.preRequestScript || ''}
                  onChange={preRequestScript => patchRequest(requestId, { preRequestScript })}
                  settings={settings}
                />
              </ErrorBoundary>
            </TabPanel>
            <TabPanel className="w-full flex-1" id="after-response">
              <ErrorBoundary
                key={uniqueKey}
                errorClassName="tall wide vertically-align font-error pad text-center"
              >
                <RequestScriptEditor
                  uniquenessKey={uniqueKey}
                  defaultValue={activeRequest.afterResponseScript || ''}
                  onChange={afterResponseScript => patchRequest(requestId, { afterResponseScript })}
                  settings={settings}
                />
              </ErrorBoundary>
            </TabPanel>
          </Tabs>
        </TabPanel>
        <TabPanel className='w-full flex-1' id='docs'>
          <div className="tall">
            {activeRequest.description ? (
              <div>
                <div className="pull-right pad bg-default">
                  <button
                    className="btn btn--clicky"
                    onClick={() => setIsRequestSettingsModalOpen(true)}
                  >
                    Edit
                  </button>
                </div>
                <div className="pad">
                  <ErrorBoundary errorClassName="font-error pad text-center">
                    <MarkdownPreview
                      heading={activeRequest.name}
                      markdown={activeRequest.description}
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
                    onClick={() => setIsRequestSettingsModalOpen(true)}
                  >
                    Add Description
                  </button>
                </p>
              </div>
            )}
          </div>
        </TabPanel>
      </Tabs>
      {isRequestSettingsModalOpen && (
        <RequestSettingsModal
          request={activeRequest}
          onHide={() => setIsRequestSettingsModalOpen(false)}
        />
      )}
    </Pane>
  );
};
