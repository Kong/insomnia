import React, { type FC, Fragment, useEffect, useRef, useState } from 'react';
import { Button, Heading, Tab, TabList, TabPanel, Tabs, ToggleButton, Toolbar } from 'react-aria-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useParams, useRouteLoaderData } from 'react-router';
import { useLocalStorage } from 'react-use';

import { CONTENT_TYPE_JSON } from '../../../common/constants';
import * as models from '../../../models';
import type { Environment } from '../../../models/environment';
import { type AuthTypes, getCombinedPathParametersFromUrl, type RequestPathParameter } from '../../../models/request';
import type { WebSocketRequest } from '../../../models/websocket-request';
import { getAuthObjectOrNull } from '../../../network/authentication';
import { RenderError } from '../../../templating/render-error';
import { tryToInterpolateRequestOrShowRenderErrorModal } from '../../../utils/try-interpolate';
import {
  buildQueryStringFromParams,
  deconstructQueryStringToParams,
  extractQueryStringFromUrl,
  joinUrlAndQueryString,
} from '../../../utils/url/querystring';
import { useReadyState } from '../../hooks/use-ready-state';
import { useRequestPatcher, useSettingsPatcher } from '../../hooks/use-request';
import { useActiveRequestSyncVCSVersion, useGitVCSVersion } from '../../hooks/use-vcs-version';
import type { WebSocketRequestLoaderData } from '../../routes/request';
import { useRootLoaderData } from '../../routes/root';
import { CodeEditor, type CodeEditorHandle } from '../codemirror/code-editor';
import { OneLineEditor } from '../codemirror/one-line-editor';
import { WebSocketPreviewMode } from '../dropdowns/websocket-preview-mode';
import { AuthWrapper } from '../editors/auth/auth-wrapper';
import { readOnlyWebsocketPairs, RequestHeadersEditor } from '../editors/request-headers-editor';
import { RequestParametersEditor } from '../editors/request-parameters-editor';
import { ErrorBoundary } from '../error-boundary';
import { Icon } from '../icon';
import { MarkdownEditor } from '../markdown-editor';
import { showAlert, showModal } from '../modals';
import { RequestRenderErrorModal } from '../modals/request-render-error-modal';
import { RequestSettingsModal } from '../modals/request-settings-modal';
import { Pane } from '../panes/pane';
import { RenderedQueryString } from '../rendered-query-string';
import { WebSocketActionBar, type WebSocketActionBarHandle } from './action-bar';

const supportedAuthTypes: AuthTypes[] = ['apikey', 'basic', 'bearer'];

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

interface FormProps {
  request: WebSocketRequest;
  previewMode: string;
  environmentId: string;
  workspaceId: string;
}

const WebSocketRequestForm: FC<FormProps> = ({ request, previewMode, environmentId, workspaceId }) => {
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
      if (err instanceof RenderError) {
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
    <form
      id="websocketMessageForm"
      onSubmit={event => {
        event.preventDefault();
        interpolateOpenAndSend(editorRef.current?.getValue() || '');
      }}
      className="relative box-border h-full w-full"
    >
      <CodeEditor
        id="websocket-message-editor"
        showPrettifyButton
        uniquenessKey={request._id}
        mode={previewMode}
        ref={editorRef}
        onChange={upsertPayloadWithValue}
        enableNunjucks
        className="w-full"
      />
    </form>
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

  const { workspaceId, requestId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    requestId: string;
  };
  const readyState = useReadyState({ requestId: activeRequest._id, protocol: 'webSocket' });
  const { settings } = useRootLoaderData();

  const disabled = readyState;

  const [previewMode, setPreviewMode] = useState(CONTENT_TYPE_JSON);

  const webSocketActionBarRef = useRef<WebSocketActionBarHandle>(null);
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
  const pathParameters = getCombinedPathParametersFromUrl(activeRequest.url, activeRequest.pathParameters || []);

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
    const parameters = [...activeRequest.parameters, ...deconstructQueryStringToParams(query)];

    // Only update if url changed
    if (url !== activeRequest.url) {
      patchRequest(requestId, { url, parameters });
      // Please refer to the comment in the request-pane
      webSocketActionBarRef.current?.setUrl(url);
    }
  };

  const gitVersion = useGitVCSVersion();
  const activeRequestSyncVersion = useActiveRequestSyncVCSVersion();
  const patchRequest = useRequestPatcher();
  const urlHasQueryParameters = activeRequest.url.includes('?');
  // Reset the response pane state when we switch requests, the environment gets modified, or the (Git|Sync)VCS version changes
  const uniqueKey = `${environment?.modified}::${requestId}::${gitVersion}::${activeRequestSyncVersion}::${activeRequestMeta.activeResponseId}`;
  const requestAuth = getAuthObjectOrNull(activeRequest.authentication);
  const isNoneOrInherited = requestAuth?.type === 'none' || requestAuth === null;

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
          ref={webSocketActionBarRef}
        />
      </header>
      <Tabs aria-label="Websocket request pane tabs" className="flex h-full w-full flex-1 flex-col">
        <TabList
          className="flex h-[--line-height-sm] w-full flex-shrink-0 items-center overflow-x-auto border-b border-solid border-b-[--hl-md] bg-[--color-bg]"
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
            <span className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-[--hl] p-1 text-xs">
              <span className="h-2 w-2 rounded-full bg-green-500" />
            </span>
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
          <Toolbar className="flex h-[--line-height-sm] w-full flex-shrink-0 items-center justify-between gap-2 border-b border-solid border-[--hl-md] px-2 py-2">
            <WebSocketPreviewMode previewMode={previewMode} onSelect={changeMode} />
            <button
              className="hover:brightness-75"
              style={{
                padding: '0 var(--padding-md)',
                marginLeft: 'var(--padding-xs)',
                height: '100%',
                border: '1px solid var(--hl-lg)',
                borderRadius: 'var(--radius-md)',
                background: readyState ? 'var(--color-surprise)' : 'inherit',
                color: readyState ? 'var(--color-font-surprise)' : 'inherit',
              }}
              type="submit"
              form="websocketMessageForm"
            >
              Send
            </button>
          </Toolbar>
          <WebSocketRequestForm
            key={uniqueKey}
            request={activeRequest}
            previewMode={previewMode}
            environmentId={environment?._id || ''}
            workspaceId={workspaceId}
          />
        </TabPanel>
        <TabPanel className="flex w-full flex-1 flex-col overflow-hidden" id="auth">
          {disabled && <PaneReadOnlyBanner />}
          <AuthWrapper
            key={uniqueKey}
            authentication={activeRequest.authentication}
            disabled={disabled}
            authTypes={supportedAuthTypes}
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
      {isRequestSettingsModalOpen && (
        <RequestSettingsModal request={activeRequest} onHide={() => setIsRequestSettingsModalOpen(false)} />
      )}
    </Pane>
  );
};
