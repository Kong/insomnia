import React, { FC, Fragment, useEffect, useRef, useState } from 'react';
import { Button, Heading, Tab, TabList, TabPanel, Tabs, ToggleButton, Toolbar } from 'react-aria-components';
import { useParams, useRouteLoaderData } from 'react-router-dom';
import { useLocalStorage } from 'react-use';
import styled from 'styled-components';

import { CONTENT_TYPE_JSON } from '../../../common/constants';
import * as models from '../../../models';
import { Environment } from '../../../models/environment';
import { AuthTypes, getCombinedPathParametersFromUrl, RequestPathParameter } from '../../../models/request';
import { WebSocketRequest } from '../../../models/websocket-request';
import { tryToInterpolateRequestOrShowRenderErrorModal } from '../../../utils/try-interpolate';
import { buildQueryStringFromParams, deconstructQueryStringToParams, extractQueryStringFromUrl, joinUrlAndQueryString } from '../../../utils/url/querystring';
import { useReadyState } from '../../hooks/use-ready-state';
import { useRequestPatcher, useSettingsPatcher } from '../../hooks/use-request';
import { useActiveRequestSyncVCSVersion, useGitVCSVersion } from '../../hooks/use-vcs-version';
import { WebSocketRequestLoaderData } from '../../routes/request';
import { useRootLoaderData } from '../../routes/root';
import { CodeEditor, CodeEditorHandle } from '../codemirror/code-editor';
import { OneLineEditor } from '../codemirror/one-line-editor';
import { WebSocketPreviewMode } from '../dropdowns/websocket-preview-mode';
import { AuthWrapper } from '../editors/auth/auth-wrapper';
import { readOnlyWebsocketPairs, RequestHeadersEditor } from '../editors/request-headers-editor';
import { RequestParametersEditor } from '../editors/request-parameters-editor';
import { ErrorBoundary } from '../error-boundary';
import { Icon } from '../icon';
import { MarkdownPreview } from '../markdown-preview';
import { showAlert, showModal } from '../modals';
import { RequestRenderErrorModal } from '../modals/request-render-error-modal';
import { RequestSettingsModal } from '../modals/request-settings-modal';
import { Pane, PaneHeader as OriginalPaneHeader } from '../panes/pane';
import { RenderedQueryString } from '../rendered-query-string';
import { WebSocketActionBar } from './action-bar';

const supportedAuthTypes: AuthTypes[] = ['apikey', 'basic', 'bearer'];

const SendMessageForm = styled.form({
  width: '100%',
  height: '100%',
  position: 'relative',
  boxSizing: 'border-box',
});

const SendButton = styled.button<{ isConnected: boolean }>(({ isConnected }) => ({
  padding: '0 var(--padding-md)',
  marginLeft: 'var(--padding-xs)',
  height: '100%',
  border: '1px solid var(--hl-lg)',
  borderRadius: 'var(--radius-md)',
  background: isConnected ? 'var(--color-surprise)' : 'inherit',
  color: isConnected ? 'var(--color-font-surprise)' : 'inherit',
  ':hover': {
    filter: 'brightness(0.8)',
  },
}));

const PaneHeader = styled(OriginalPaneHeader)({
  '&&': { alignItems: 'stretch' },
});
const PaneReadOnlyBannerContainer = styled.div({
  paddingTop: 'var(--padding-md)',
  paddingLeft: 'var(--padding-md)',
  paddingRight: 'var(--padding-md)',
});
const PaneReadOnlyBanner = () => {
  return (
    <PaneReadOnlyBannerContainer>
      <p className="notice info no-margin-top no-margin-bottom">
        This section is now locked since the connection has already been established. To change these settings, please disconnect first.
      </p>
    </PaneReadOnlyBannerContainer>
  );
};

interface FormProps {
  request: WebSocketRequest;
  previewMode: string;
  environmentId: string;
  workspaceId: string;
}

const WebSocketRequestForm: FC<FormProps> = ({
  request,
  previewMode,
  environmentId,
  workspaceId,
}) => {
  const editorRef = useRef<CodeEditorHandle>(null);

  useEffect(() => {
    const init = async () => {
      const payload = await models.webSocketPayload.getByParentId(request._id);
      const msg = payload?.value || '';
      editorRef.current?.setValue(msg);
    };

    init();
  }, [request._id]);

  // NOTE: Nunjucks interpolation can throw errors
  const interpolateOpenAndSend = async (payload: string) => {
    try {
      const renderedMessage = await tryToInterpolateRequestOrShowRenderErrorModal({ request, environmentId, payload });
      const readyState = await window.main.webSocket.readyState.getCurrent({ requestId: request._id });
      if (!readyState) {
        const workspaceCookieJar = await models.cookieJar.getOrCreateForParentId(workspaceId);
        const rendered = await tryToInterpolateRequestOrShowRenderErrorModal({
          request,
          environmentId,
          payload: {
            url: request.url,
            headers: request.headers,
            authentication: request.authentication,
            parameters: request.parameters.filter(p => !p.disabled),
            workspaceCookieJar,
          },
        });
        window.main.webSocket.open({
          requestId: request._id,
          workspaceId,
          url: joinUrlAndQueryString(rendered.url, buildQueryStringFromParams(rendered.parameters)),
          headers: rendered.headers,
          authentication: rendered.authentication,
          cookieJar: rendered.workspaceCookieJar,
          initialPayload: renderedMessage,
        });
        return;
      }
      window.main.webSocket.event.send({ requestId: request._id, payload: renderedMessage });
    } catch (err) {
      if (err.type === 'render') {
        showModal(RequestRenderErrorModal, {
          request,
          error: err,
        });
      } else {
        showAlert({
          title: 'Unexpected Request Failure',
          message: (
            <div>
              <p>The request failed due to an unhandled error:</p>
              <code className="wide selectable">
                <pre>{err.message}</pre>
              </code>
            </div>
          ),
        });
      }
    }
  };

  const upsertPayloadWithValue = async (value: string) => {
    const payload = await models.webSocketPayload.getByParentId(request._id);
    if (payload) {
      await models.webSocketPayload.update(payload, { value });
    } else {
      await models.webSocketPayload.create({
        parentId: request._id,
        value,
        mode: previewMode,
      });
    }
  };

  // TODO(@dmarby): Wrap the CodeEditor in a NunjucksEnabledProvider here?
  // To allow for disabling rendering of messages based on a per-request setting.
  // Same as with regular requests
  return (
    <SendMessageForm
      id="websocketMessageForm"
      onSubmit={event => {
        event.preventDefault();
        interpolateOpenAndSend(editorRef.current?.getValue() || '');
      }}
    >
      <CodeEditor
        id="websocket-message-editor"
        showPrettifyButton
        uniquenessKey={request._id}
        mode={previewMode}
        ref={editorRef}
        onChange={upsertPayloadWithValue}
        enableNunjucks
      />
    </SendMessageForm>
  );
};

interface Props {
  environment: Environment | null;
}

// requestId is something we can read from the router params in the future.
// essentially we can lift up the states and merge request pane and response pane into a single page and divide the UI there.
// currently this is blocked by the way page layout divide the panes with dragging functionality
// TODO: @gatzjames discuss above assertion in light of request and settings drills
export const WebSocketRequestPane: FC<Props> = ({ environment }) => {
  const { activeRequest, activeRequestMeta } = useRouteLoaderData('request/:requestId') as WebSocketRequestLoaderData;

  const { workspaceId, requestId } = useParams() as { organizationId: string; projectId: string; workspaceId: string; requestId: string };
  const readyState = useReadyState({ requestId: activeRequest._id, protocol: 'webSocket' });
  const { settings } = useRootLoaderData();

  const disabled = readyState;

  const [previewMode, setPreviewMode] = useState(CONTENT_TYPE_JSON);

  const [dismissPathParameterTip, setDismissPathParameterTip] = useLocalStorage('dismissPathParameterTip', '');

  useEffect(() => {
    let isMounted = true;
    const fn = async () => {
      const payload = await models.webSocketPayload.getByParentId(requestId);
      if (isMounted && payload) {
        setPreviewMode(payload.mode);
      }
    };
    fn();
    return () => {
      isMounted = false;
    };
  }, [requestId]);

  const changeMode = (mode: string) => {
    setPreviewMode(mode);
    upsertPayloadWithMode(mode);
  };

  // Path parameters are path segments that start with a colon (:)
  const pathParameters = getCombinedPathParametersFromUrl(activeRequest.url, activeRequest.pathParameters);

  const onPathParameterChange = (pathParameters: RequestPathParameter[]) => {
    patchRequest(requestId, { pathParameters });
  };

  const parametersCount = pathParameters.length + activeRequest.parameters.filter(p => !p.disabled).length;
  const headersCount = activeRequest.headers.filter(h => !h.disabled).length + readOnlyWebsocketPairs.length;
  const patchSettings = useSettingsPatcher();
  const upsertPayloadWithMode = async (mode: string) => {
    // @TODO: multiple payloads
    const payload = await models.webSocketPayload.getByParentId(requestId);
    if (payload) {
      await models.webSocketPayload.update(payload, { mode });
    } else {
      await models.webSocketPayload.create({
        parentId: requestId,
        value: '',
        mode,
      });
    }
  };
  const [isRequestSettingsModalOpen, setIsRequestSettingsModalOpen] = useState(false);

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

  return (
    <Pane type="request">
      <PaneHeader>
        <WebSocketActionBar
          key={uniqueKey}
          request={activeRequest}
          environmentId={environment?._id || ''}
          defaultValue={activeRequest.url}
          readyState={readyState}
          onChange={url => patchRequest(requestId, { url })}
        />
      </PaneHeader>
      <Tabs aria-label='Websocket request pane tabs' className="flex-1 w-full h-full flex flex-col">
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
          <div className="flex-shrink-0 grid flex-1 [grid-template-rows:minmax(auto,min-content)] [grid-template-columns:100%] overflow-hidden">
            <div className="min-h-[2rem] max-h-full flex flex-col overflow-y-auto [&_.key-value-editor]:p-0 flex-1">
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
          <Toolbar className="w-full flex-shrink-0 px-2 border-b border-solid border-[--hl-md] py-2 h-[--line-height-sm] flex items-center gap-2 justify-between">
            <WebSocketPreviewMode previewMode={previewMode} onSelect={changeMode} />
            <SendButton
              type="submit"
              form="websocketMessageForm"
              isConnected={readyState}
            >
              Send
            </SendButton>
          </Toolbar>
          <WebSocketRequestForm
            key={uniqueKey}
            request={activeRequest}
            previewMode={previewMode}
            environmentId={environment?._id || ''}
            workspaceId={workspaceId}
          />
        </TabPanel>
        <TabPanel className='w-full flex-1 flex flex-col overflow-hidden' id='auth'>
          {disabled && <PaneReadOnlyBanner />}
          <AuthWrapper
            key={uniqueKey}
            authentication={activeRequest.authentication}
            disabled={disabled}
            authTypes={supportedAuthTypes}
          />
        </TabPanel>
        <TabPanel className='w-full flex-1 overflow-y-auto ' id='headers'>
          {disabled && <PaneReadOnlyBanner />}
          <RequestHeadersEditor
            key={uniqueKey}
            headers={activeRequest.headers}
            bulk={false}
            isDisabled={readyState}
            requestType="WebSocketRequest"
          />
        </TabPanel>
        <TabPanel className='w-full flex-1 overflow-y-auto ' id='docs'>
          {activeRequest.description ? (
            <div>
              <div className="pull-right pad bg-default">
                <button className="btn btn--clicky" onClick={() => setIsRequestSettingsModalOpen(true)}>
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
                  <button className="btn btn--clicky faint" onClick={() => setIsRequestSettingsModalOpen(true)}>
                  Add Description
                </button>
              </p>
            </div>
          )}
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
