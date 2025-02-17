import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import { useFetcher, useParams, useRouteLoaderData, useSearchParams } from 'react-router-dom';
import { useInterval } from 'react-use';

import { database as db } from '../../common/database';
import * as models from '../../models';
import { vaultEnvironmentRuntimePath } from '../../models/environment';
import type { Request } from '../../models/request';
import { isEventStreamRequest, isGraphqlSubscriptionRequest } from '../../models/request';
import { isRequestGroup, type RequestGroup } from '../../models/request-group';
import { getOrInheritAuthentication, getOrInheritHeaders } from '../../network/network';
import { tryToInterpolateRequestOrShowRenderErrorModal } from '../../utils/try-interpolate';
import { buildQueryStringFromParams, joinUrlAndQueryString } from '../../utils/url/querystring';
import { SegmentEvent } from '../analytics';
import { useReadyState } from '../hooks/use-ready-state';
import { useRequestPatcher } from '../hooks/use-request';
import { useRequestMetaPatcher } from '../hooks/use-request';
import { useTimeoutWhen } from '../hooks/useTimeoutWhen';
import type { ConnectActionParams, RequestLoaderData, SendActionParams } from '../routes/request';
import { useRootLoaderData } from '../routes/root';
import type { WorkspaceLoaderData } from '../routes/workspace';
import { Dropdown, type DropdownHandle, DropdownItem, DropdownSection, ItemContent } from './base/dropdown';
import { OneLineEditor, type OneLineEditorHandle } from './codemirror/one-line-editor';
import { MethodDropdown } from './dropdowns/method-dropdown';
import { createKeybindingsHandler, useDocBodyKeyboardShortcuts } from './keydown-binder';
import { GenerateCodeModal } from './modals/generate-code-modal';
import { showAlert, showModal, showPrompt } from './modals/index';
import { InputVaultKeyModal } from './modals/input-valut-key-modal';
import { VariableMissingErrorModal } from './modals/variable-missing-error-modal';

interface Props {
  handleAutocompleteUrls: () => Promise<string[]>;
  nunjucksPowerUserMode: boolean;
  uniquenessKey: string;
  onPaste: (text: string) => void;
}

export interface RequestUrlBarHandle {
  focusInput: () => void;
}

export const RequestUrlBar = forwardRef<RequestUrlBarHandle, Props>(({
  handleAutocompleteUrls,
  uniquenessKey,
  onPaste,
}, ref) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { userSession } = useRootLoaderData();
  const { vaultKey } = userSession;
  const [showEnvVariableMissingModal, setShowEnvVariableMissingModal] = useState(false);
  const [showInputVaultKeyModal, setShowInputVaultKeyModal] = useState(false);
  const [undefinedEnvironmentVariables, setUndefinedEnvironmentVariables] = useState('');
  const undefinedEnvironmentVariableList = undefinedEnvironmentVariables?.split(',');
  if (searchParams.has('error')) {
    if (searchParams.has('envVariableMissing') && searchParams.get('undefinedEnvironmentVariables')) {
      setShowEnvVariableMissingModal(true);
      setUndefinedEnvironmentVariables(searchParams.get('undefinedEnvironmentVariables')!);
    } else {
      // only for request render error
      showAlert({
        title: 'Unexpected Request Failure',
        message: (
          <div>
            <p>The request failed due to an unhandled error:</p>
            <code className="wide selectable">
              <pre>{searchParams.get('error')}</pre>
            </code>
          </div>
        ),
      });
    }

    // clean up params
    searchParams.delete('error');
    setSearchParams({});
  }

  const {
    activeWorkspace,
    activeEnvironment,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const { settings } = useRootLoaderData();
  const { hotKeyRegistry } = settings;
  const { activeRequest, activeRequestMeta: { downloadPath } } = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const patchRequestMeta = useRequestMetaPatcher();
  const methodDropdownRef = useRef<DropdownHandle>(null);
  const dropdownRef = useRef<DropdownHandle>(null);
  const inputRef = useRef<OneLineEditorHandle>(null);
  const isRealtimeRequest = activeRequest && (isEventStreamRequest(activeRequest) || isGraphqlSubscriptionRequest(activeRequest));

  const focusInput = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focusEnd();
    }
  }, [inputRef]);

  useImperativeHandle(ref, () => ({ focusInput }), [focusInput]);

  const [currentInterval, setCurrentInterval] = useState<number | null>(null);
  const [currentTimeout, setCurrentTimeout] = useState<number | undefined>(undefined);
  const fetcher = useFetcher();

  const { organizationId, projectId, workspaceId, requestId } = useParams() as { organizationId: string; projectId: string; workspaceId: string; requestId: string };
  const connect = useCallback((connectParams: ConnectActionParams) => {
    fetcher.submit(JSON.stringify(connectParams),
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/connect`,
        method: 'post',
        encType: 'application/json',
      });
  }, [fetcher, organizationId, projectId, requestId, workspaceId]);
  const send = useCallback((sendParams: SendActionParams) => {
    // file://./../routes/request.tsx#sendAction
    fetcher.submit(JSON.stringify(sendParams),
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/send`,
        method: 'post',
        encType: 'application/json',
      });
  }, [fetcher, organizationId, projectId, requestId, workspaceId]);

  const sendOrConnect = useCallback(async (shouldPromptForPathAfterResponse?: boolean, ignoreUndefinedEnvVariable?: boolean) => {
    models.stats.incrementExecutedRequests();
    window.main.trackSegmentEvent({
      event: SegmentEvent.requestExecute,
      properties: {
        preferredHttpVersion: settings.preferredHttpVersion,
        // @ts-expect-error -- who cares
        authenticationType: activeRequest.authentication?.type,
        mimeType: activeRequest.body.mimeType,
      },
    });
    // reset timeout
    setCurrentTimeout(undefined);

    if (isEventStreamRequest(activeRequest) || isGraphqlSubscriptionRequest(activeRequest)) {
      const startListening = async () => {
        const environmentId = activeEnvironment._id;
        const workspaceId = activeWorkspace._id;
        // Render any nunjucks tags in the url/headers/authentication settings/cookies
        const workspaceCookieJar = await models.cookieJar.getOrCreateForParentId(workspaceId);

        const ancestors = await db.withAncestors<Request | RequestGroup>(activeRequest, [
          models.requestGroup.type,
        ]);
        // check for authentication overrides in parent folders
        const requestGroups = ancestors.filter(isRequestGroup) as RequestGroup[];
        activeRequest.authentication = getOrInheritAuthentication({ request: activeRequest, requestGroups });
        activeRequest.headers = getOrInheritHeaders({ request: activeRequest, requestGroups });
        const rendered = await tryToInterpolateRequestOrShowRenderErrorModal({
          request: activeRequest,
          environmentId,
          payload: {
            url: activeRequest.url,
            headers: activeRequest.headers,
            authentication: activeRequest.authentication,
            parameters: activeRequest.parameters.filter(p => !p.disabled),
            workspaceCookieJar,
          },
        });
        rendered && connect({
          url: joinUrlAndQueryString(rendered.url, buildQueryStringFromParams(rendered.parameters)),
          headers: rendered.headers,
          authentication: rendered.authentication,
          cookieJar: rendered.workspaceCookieJar,
          suppressUserAgent: rendered.suppressUserAgent,
        });
      };
      startListening();
      return;
    }

    try {
      send({ requestId, shouldPromptForPathAfterResponse, ignoreUndefinedEnvVariable });
    } catch (err) {
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
  }, [activeEnvironment._id, activeRequest, activeWorkspace._id, connect, requestId, send, settings.preferredHttpVersion]);

  useEffect(() => {
    const sendOnMetaEnter = (event: KeyboardEvent) => {
      if (event.metaKey && event.key === 'Enter') {
        sendOrConnect();
      }
    };
    document.getElementById('sidebar-request-gridlist')?.addEventListener('keydown', sendOnMetaEnter, { capture: true });
    return () => {
      document.getElementById('sidebar-request-gridlist')?.removeEventListener('keydown', sendOnMetaEnter, { capture: true });
    };
  }, [sendOrConnect]);

  useInterval(sendOrConnect, currentInterval && fetcher.state === 'idle' ? currentInterval : null);
  useTimeoutWhen(sendOrConnect, currentTimeout, !!currentTimeout);
  const patchRequest = useRequestPatcher();

  useDocBodyKeyboardShortcuts({
    request_focusUrl: () => {
      inputRef.current?.focusEnd();
      inputRef.current?.selectAll();
    },
    request_send: () => {
      if (activeRequest.url) {
        sendOrConnect();
      }
    },
    request_toggleHttpMethodMenu: () => {
      methodDropdownRef.current?.toggle();
    },
    request_showOptions: () => {
      dropdownRef.current?.toggle(true);
    },
  });

  const buttonText = isRealtimeRequest ? 'Connect' : (downloadPath ? 'Download' : 'Send');
  const borderRadius = isRealtimeRequest ? 'rounded-sm' : 'rounded-l-sm';
  const { url, method } = activeRequest;
  const isEventStreamOpen = useReadyState({ requestId: activeRequest._id, protocol: 'curl' });
  const isGraphQLSubscriptionOpen = useReadyState({ requestId: activeRequest._id, protocol: 'webSocket' });
  const isCancellable = currentInterval || currentTimeout || isEventStreamOpen || isGraphQLSubscriptionOpen;
  return (
    <div className="w-full flex justify-between self-stretch items-stretch">
      <div className="flex items-center">
        <MethodDropdown
          ref={methodDropdownRef}
          onChange={method => patchRequest(requestId, { method })}
          method={method}
        />
      </div>
      <div className="flex flex-1 p-1 items-center">
        <OneLineEditor
          id="request-url-bar"
          key={uniquenessKey}
          ref={inputRef}
          type="text"
          getAutocompleteConstants={handleAutocompleteUrls}
          placeholder="https://api.myproduct.com/v1/users"
          defaultValue={url}
          onChange={url => patchRequest(requestId, { url })}
          onKeyDown={createKeybindingsHandler({
            'Enter': () => sendOrConnect(),
          })}
          onPaste={onPaste}
        />
        <div className='flex self-stretch'>
          {isCancellable ? (
            <button
              type="button"
              className="px-[--padding-md] bg-[--color-surprise] text-[--color-font-surprise] rounded-sm"
              onClick={() => {
                if (isEventStreamRequest(activeRequest)) {
                  window.main.curl.close({ requestId: activeRequest._id });
                  return;
                }
                if (isGraphqlSubscriptionRequest(activeRequest)) {
                  window.main.webSocket.close({ requestId: activeRequest._id });
                }
                setCurrentInterval(null);
                setCurrentTimeout(undefined);
              }}
            >
              {isRealtimeRequest ? 'Disconnect' : 'Cancel'}
            </button>
          ) : (
            <>
              <button onClick={() => sendOrConnect()} className={`px-[--padding-md] bg-[--color-surprise] text-[--color-font-surprise] ${borderRadius}`} type="button">{buttonText}</button>
              {isRealtimeRequest ? null : (
                <Dropdown
                  key="dropdown"
                  className="flex"
                  ref={dropdownRef}
                  aria-label="Request Options"
                  closeOnSelect={false}
                  triggerButton={
                    <Button
                      className="px-1 bg-[--color-surprise] text-[--color-font-surprise] rounded-r-sm"
                      style={{
                        borderTopRightRadius: '0.125rem',
                        borderBottomRightRadius: '0.125rem',
                      }}
                    >
                      <i className="fa fa-caret-down" />
                    </Button>
                  }
                >
                  <DropdownSection
                    aria-label="Basic Section"
                    title="Basic"
                  >
                    <DropdownItem aria-label="send-now">
                      <ItemContent icon="arrow-circle-o-right" label="Send Now" hint={hotKeyRegistry.request_send} onClick={sendOrConnect} />
                    </DropdownItem>
                    <DropdownItem aria-label='Generate Client Code'>
                      <ItemContent
                        icon="code"
                        label="Generate Client Code"
                        onClick={() => showModal(GenerateCodeModal, { request: activeRequest })}
                      />
                    </DropdownItem>
                  </DropdownSection>
                  <DropdownSection
                    aria-label="Advanced Section"
                    title="Advanced"
                  >
                    <DropdownItem aria-label='Send After Delay'>
                      <ItemContent
                        icon="clock-o"
                        label="Send After Delay"
                        onClick={() => showPrompt({
                          inputType: 'decimal',
                          title: 'Send After Delay',
                          label: 'Delay in seconds',
                          defaultValue: '3',
                          onComplete: seconds => {
                            setCurrentTimeout(+seconds * 1000);
                          },
                        })}
                      />
                    </DropdownItem>
                    <DropdownItem aria-label='Repeat on Interval'>
                      <ItemContent
                        icon="repeat"
                        label="Repeat on Interval"
                        onClick={() => showPrompt({
                          inputType: 'decimal',
                          title: 'Send on Interval',
                          label: 'Interval in seconds',
                          defaultValue: '3',
                          submitName: 'Start',
                          onComplete: seconds => {
                            sendOrConnect();
                            setCurrentInterval(+seconds * 1000);
                          },
                        })}
                      />
                    </DropdownItem>
                    {downloadPath
                      ? (<DropdownItem aria-label='Stop Auto-Download'>
                        <ItemContent
                          icon="stop-circle"
                          label="Stop Auto-Download"
                          withPrompt
                          onClick={() => patchRequestMeta(activeRequest._id, { downloadPath: null })}
                        />
                      </DropdownItem>)
                      : (<DropdownItem aria-label='Download After Send'>
                        <ItemContent
                          icon="download"
                          label="Download After Send"
                          onClick={async () => {
                            const { canceled, filePaths } = await window.dialog.showOpenDialog({
                              title: 'Select Download Location',
                              buttonLabel: 'Select',
                              properties: ['openDirectory'],
                            });
                            if (canceled) {
                              return;
                            }
                            patchRequestMeta(activeRequest._id, { downloadPath: filePaths[0] });
                          }}
                        />
                      </DropdownItem>)}
                    <DropdownItem aria-label='Send And Download'>
                      <ItemContent icon="download" label="Send And Download" onClick={() => sendOrConnect(true)} />
                    </DropdownItem>
                  </DropdownSection>
                </Dropdown>
              )}
            </>
          )}
        </div>
      </div>
      <VariableMissingErrorModal
        isOpen={showEnvVariableMissingModal}
        title={undefinedEnvironmentVariableList?.length === 1 ? '1 environment variable is missing' : `${undefinedEnvironmentVariableList?.length} environment variables are missing`}
        okText='Execute anyways'
        onOk={() => {
          setShowEnvVariableMissingModal(false);
          sendOrConnect(false, true);
        }}
        onCancel={() => setShowEnvVariableMissingModal(false)}
      >
        <div>
          These environment variables have been defined, but have not been valued with in the currently active environment:
          <div className='flex gap-2 flex-wrap max-h-80 overflow-y-auto'>
            {undefinedEnvironmentVariableList?.map(item => {
              return <div key={item} className="bg-[--color-surprise] text-[--color-font-surprise] mt-3 px-3 py-1 mr-3 rounded-sm">{item}</div>;
            })}
          </div>
        </div>
        {!vaultKey && undefinedEnvironmentVariableList.some(variableName => variableName.startsWith(`${vaultEnvironmentRuntimePath}.`)) &&
          <div className='mt-4'>
            <p>These are secret environment variables. However, the required vault key has not been provided yet.</p>
            <Button
              className="py-1 aria-pressed:bg-[--hl-sm] underline text-[--color-info] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] cursor-"
              onPress={() => {
                setShowInputVaultKeyModal(true);
                setShowEnvVariableMissingModal(false);
              }}
            >
              Click to input vault key
            </Button>
            <div className='flex gap-2 flex-wrap max-h-80 overflow-y-auto'>
              {undefinedEnvironmentVariableList?.filter(variableName => variableName.startsWith(`${vaultEnvironmentRuntimePath}.`)).map(item => {
                return <div key={item} className="bg-[--color-surprise] text-[--color-font-surprise] mt-3 px-3 py-1 mr-3 rounded-sm">{item}</div>;
              })}
            </div>
          </div>
        }
      </VariableMissingErrorModal>
      {showInputVaultKeyModal &&
        <InputVaultKeyModal onClose={() => setShowInputVaultKeyModal(false)} />
      }
    </div>
  );
});

RequestUrlBar.displayName = 'RequestUrlBar';
