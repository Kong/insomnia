import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Button, Link } from 'react-aria-components';
import { useParams, useSearchParams } from 'react-router';
import * as reactUse from 'react-use';

import { SECURITY_SETTINGS_PATH_LABEL } from '~/common/misc';
import type { Request, RequestGroup } from '~/insomnia-data';
import { models, services } from '~/insomnia-data';
import { useRootLoaderData } from '~/root';
import {
  type ConnectActionParams,
  useRequestConnectActionFetcher,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.connect';
import {
  type SendActionParams,
  useDebugRequestSendActionFetcher,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.send';
import { OneLineEditor, type OneLineEditorHandle } from '~/ui/components/.client/codemirror/one-line-editor';
import { showSettingsModal } from '~/ui/components/modals/settings-modal';

import { database as db } from '../../common/database';
import { getOrInheritAuthentication, getOrInheritHeaders } from '../../network/network';
import { useWorkspaceLoaderData } from '../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import {
  type RequestLoaderData,
  useRequestLoaderData,
} from '../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { AnalyticsEvent } from '../../ui/analytics';
import { tryToInterpolateRequestOrShowRenderErrorModal } from '../../utils/try-interpolate';
import { buildQueryStringFromParams, joinUrlAndQueryString } from '../../utils/url/querystring';
import { useInsomniaTabContext } from '../context/app/insomnia-tab-context';
import { useReadyState } from '../hooks/use-ready-state';
import { useRequestMetaPatcher, useRequestPatcher } from '../hooks/use-request';
import { useTimeoutWhen } from '../hooks/use-timeout-when';
import { Dropdown, type DropdownHandle, DropdownItem, DropdownSection, ItemContent } from './base/dropdown';
import { MethodDropdown } from './dropdowns/method-dropdown';
import { createKeybindingsHandler, useDocBodyKeyboardShortcuts } from './keydown-binder';
import { showModal } from './modals';
import { AlertModal } from './modals/alert-modal';
import { GenerateCodeModal } from './modals/generate-code-modal';
import { InputVaultKeyModal } from './modals/input-vault-key-modal';
import { PromptModal } from './modals/prompt-modal';
import { VariableMissingErrorModal } from './modals/variable-missing-error-modal';

const { isRequestGroup } = models.requestGroup;
const { isEventStreamRequest, isGraphqlSubscriptionRequest } = models.request;
interface Props {
  handleAutocompleteUrls: () => Promise<string[]>;
  nunjucksPowerUserMode: boolean;
  uniquenessKey: string;
  onPaste: (text: string) => void;
}

export interface RequestUrlBarHandle {
  focusInput: () => void;
  setUrl: (url: string) => void;
}

export const RequestUrlBar = forwardRef<RequestUrlBarHandle, Props>(
  ({ handleAutocompleteUrls, uniquenessKey, onPaste }, ref) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const { userSession } = useRootLoaderData()!;
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
        const errorMessage = searchParams.get('error') || '';
        // detects a string to replace with a link to settings
        const linkText = SECURITY_SETTINGS_PATH_LABEL;
        const hasLink = errorMessage.endsWith(linkText);

        const modifiedString = hasLink ? errorMessage.slice(0, errorMessage.length - linkText.length) : errorMessage;
        const close = showModal(AlertModal, {
          title: 'Unexpected Request Failure',
          message: (
            <div>
              <p>The request failed due to an unhandled error:</p>
              <code className="wide selectable">
                <div className="w-full overflow-y-auto text-wrap">
                  {modifiedString}
                  {hasLink && (
                    <Link
                      className="cursor-pointer text-(--color-surprise)"
                      onPress={() => {
                        close();
                        showSettingsModal({ tab: 'general' });
                      }}
                    >
                      {linkText}
                    </Link>
                  )}
                </div>
              </code>
            </div>
          ),
        });
      }

      // clean up params
      searchParams.delete('error');
      setSearchParams({});
    }

    const { activeWorkspace, activeEnvironment } = useWorkspaceLoaderData()!;
    const { settings } = useRootLoaderData()!;
    const { hotKeyRegistry } = settings;
    const {
      activeRequest,
      activeRequestMeta: { downloadPath },
    } = useRequestLoaderData()! as RequestLoaderData;
    const patchRequestMeta = useRequestMetaPatcher();
    const methodDropdownRef = useRef<DropdownHandle>(null);
    const dropdownRef = useRef<DropdownHandle>(null);
    const inputRef = useRef<OneLineEditorHandle>(null);
    const isRealtimeRequest =
      activeRequest && (isEventStreamRequest(activeRequest) || isGraphqlSubscriptionRequest(activeRequest));

    const focusInput = useCallback(() => {
      if (inputRef.current) {
        inputRef.current.focusEnd();
      }
    }, [inputRef]);

    const setUrl = useCallback(
      (url: string) => {
        if (inputRef.current) {
          inputRef.current.setValue(url);
        }
      },
      [inputRef],
    );

    useImperativeHandle(ref, () => ({ focusInput, setUrl }), [focusInput, setUrl]);

    const [currentInterval, setCurrentInterval] = useState<number | null>(null);
    const [currentTimeout, setCurrentTimeout] = useState<number | undefined>();
    const connectRequestFetcher = useRequestConnectActionFetcher();
    const sendRequestFetcher = useDebugRequestSendActionFetcher();

    const { updateTabById } = useInsomniaTabContext();

    const { organizationId, projectId, workspaceId, requestId } = useParams() as {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      requestId: string;
    };
    const connectSubmit = connectRequestFetcher.submit;
    const connect = useCallback(
      (connectParams: ConnectActionParams) => {
        connectSubmit({
          organizationId,
          projectId,
          workspaceId,
          requestId,
          connectParams,
        });
      },
      [connectSubmit, organizationId, projectId, requestId, workspaceId],
    );
    const sendRequestSubmit = sendRequestFetcher.submit;
    const send = useCallback(
      (params: SendActionParams) => {
        sendRequestSubmit({
          organizationId,
          projectId,
          workspaceId,
          requestId,
          params,
        });
      },
      [organizationId, projectId, requestId, sendRequestSubmit, workspaceId],
    );

    const sendOrConnect = useCallback(
      async (shouldPromptForPathAfterResponse?: boolean, ignoreUndefinedEnvVariable?: boolean) => {
        updateTabById?.(requestId, { temporary: false });
        services.stats.incrementExecutedRequests();
        // reset timeout
        setCurrentTimeout(undefined);

        if (isEventStreamRequest(activeRequest) || isGraphqlSubscriptionRequest(activeRequest)) {
          const startListening = async () => {
            const environmentId = activeEnvironment._id;
            const workspaceId = activeWorkspace._id;
            // Render any nunjucks tags in the url/headers/authentication settings/cookies
            const workspaceCookieJar = await services.cookieJar.getOrCreateForParentId(workspaceId);

            const ancestors = await db.withAncestors<Request | RequestGroup>(activeRequest, [models.requestGroup.type]);
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
            rendered &&
              connect({
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
          const errorMessage = err instanceof Error ? err.message : String(err);
          showModal(AlertModal, {
            title: 'Unexpected Request Failure',
            message: (
              <div>
                <p>The request failed due to an unhandled error:</p>
                <code className="wide selectable">
                  <pre>{errorMessage}</pre>
                </code>
              </div>
            ),
          });
        }
      },
      [activeEnvironment._id, activeRequest, activeWorkspace._id, connect, requestId, send, updateTabById],
    );

    useEffect(() => {
      const sendOnMetaEnter = (event: KeyboardEvent) => {
        if (event.metaKey && event.key === 'Enter') {
          sendOrConnect();
        }
      };
      document
        .getElementById('sidebar-request-gridlist')
        ?.addEventListener('keydown', sendOnMetaEnter, { capture: true });
      return () => {
        document
          .getElementById('sidebar-request-gridlist')
          ?.removeEventListener('keydown', sendOnMetaEnter, { capture: true });
      };
    }, [sendOrConnect]);

    reactUse.useInterval(
      sendOrConnect,
      currentInterval && connectRequestFetcher.state === 'idle' ? currentInterval : null,
    );
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

    const buttonText = isRealtimeRequest ? 'Connect' : downloadPath ? 'Download' : 'Send';
    const borderRadius = isRealtimeRequest ? 'rounded-xs' : 'rounded-l-sm';
    const { url, method } = activeRequest;
    const isEventStreamOpen = useReadyState({ requestId: activeRequest._id, protocol: 'curl' });
    const isGraphQLSubscriptionOpen = useReadyState({ requestId: activeRequest._id, protocol: 'webSocket' });
    const isCancellable = currentInterval || currentTimeout || isEventStreamOpen || isGraphQLSubscriptionOpen;
    return (
      <div className="flex w-full items-stretch justify-between self-stretch">
        <div className="flex items-center">
          <MethodDropdown
            ref={methodDropdownRef}
            onChange={method => patchRequest(requestId, { method })}
            method={method}
          />
        </div>
        <div className="flex flex-1 items-center p-1">
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
              Enter: () => sendOrConnect(),
            })}
            onPaste={onPaste}
          />
          <div className="flex self-stretch">
            {isCancellable ? (
              <button
                type="button"
                className="rounded-xs bg-(--color-surprise) px-(--padding-md) text-(--color-font-surprise)"
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
                <button
                  onClick={() => sendOrConnect()}
                  className={`bg-(--color-surprise) px-(--padding-md) text-(--color-font-surprise) ${borderRadius}`}
                  type="button"
                >
                  {buttonText}
                </button>
                {isRealtimeRequest ? null : (
                  <Dropdown
                    key="dropdown"
                    className="flex"
                    ref={dropdownRef}
                    aria-label="Request Options"
                    closeOnSelect={false}
                    triggerButton={
                      <Button
                        className="rounded-r-sm bg-(--color-surprise) px-1 text-(--color-font-surprise)"
                        style={{
                          borderTopRightRadius: '0.125rem',
                          borderBottomRightRadius: '0.125rem',
                        }}
                      >
                        <i className="fa fa-caret-down" />
                      </Button>
                    }
                  >
                    <DropdownSection aria-label="Basic Section" title="Basic">
                      <DropdownItem aria-label="send-now">
                        <ItemContent
                          icon="arrow-circle-o-right"
                          label="Send Now"
                          hint={hotKeyRegistry.request_send}
                          onClick={sendOrConnect}
                        />
                      </DropdownItem>
                      <DropdownItem aria-label="Generate Client Code">
                        <ItemContent
                          icon="code"
                          label="Generate Client Code"
                          onClick={() => {
                            window.main.trackAnalyticsEvent({ event: AnalyticsEvent.requestSendMenuGenerateCodeClicked });
                            showModal(GenerateCodeModal, { request: activeRequest });
                          }}
                        />
                      </DropdownItem>
                    </DropdownSection>
                    <DropdownSection aria-label="Advanced Section" title="Advanced">
                      <DropdownItem aria-label="Send After Delay">
                        <ItemContent
                          icon="clock-o"
                          label="Send After Delay"
                          onClick={() => {
                            window.main.trackAnalyticsEvent({ event: AnalyticsEvent.requestSendMenuSendAfterDelayClicked });
                            showModal(PromptModal, {
                              inputType: 'decimal',
                              title: 'Send After Delay',
                              label: 'Delay in seconds',
                              defaultValue: '3',
                              onComplete: seconds => {
                                setCurrentTimeout(+seconds * 1000);
                              },
                            });
                          }}
                        />
                      </DropdownItem>
                      <DropdownItem aria-label="Repeat on Interval">
                        <ItemContent
                          icon="repeat"
                          label="Repeat on Interval"
                          onClick={() => {
                            window.main.trackAnalyticsEvent({
                              event: AnalyticsEvent.requestSendMenuRepeatAfterIntervalClicked,
                            });
                            showModal(PromptModal, {
                              inputType: 'decimal',
                              title: 'Send on Interval',
                              label: 'Interval in seconds',
                              defaultValue: '3',
                              submitName: 'Start',
                              onComplete: seconds => {
                                sendOrConnect();
                                setCurrentInterval(+seconds * 1000);
                              },
                            });
                          }}
                        />
                      </DropdownItem>
                      {downloadPath ? (
                        <DropdownItem aria-label="Stop Auto-Download">
                          <ItemContent
                            icon="stop-circle"
                            label="Stop Auto-Download"
                            withPrompt
                            onClick={() => patchRequestMeta(activeRequest._id, { downloadPath: null })}
                          />
                        </DropdownItem>
                      ) : (
                        <DropdownItem aria-label="Download After Send">
                          <ItemContent
                            icon="download"
                            label="Download After Send"
                            onClick={async () => {
                              window.main.trackAnalyticsEvent({
                                event: AnalyticsEvent.requestSendMenuDownloadAfterSendClicked,
                              });
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
                        </DropdownItem>
                      )}
                      <DropdownItem aria-label="Send And Download">
                        <ItemContent
                          icon="download"
                          label="Send And Download"
                          onClick={() => {
                            window.main.trackAnalyticsEvent({
                              event: AnalyticsEvent.requestSendMenuSendAndDownloadClicked,
                            });
                            sendOrConnect(true);
                          }}
                        />
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
          title={
            undefinedEnvironmentVariableList?.length === 1
              ? '1 environment variable is missing'
              : `${undefinedEnvironmentVariableList?.length} environment variables are missing`
          }
          okText="Execute anyway"
          onOk={() => {
            setShowEnvVariableMissingModal(false);
            sendOrConnect(false, true);
          }}
          onCancel={() => setShowEnvVariableMissingModal(false)}
        >
          <div>
            These environment variables have been defined, but have not been assigned a value within the currently
            active environment:
            <div className="flex max-h-80 flex-wrap gap-2 overflow-y-auto">
              {undefinedEnvironmentVariableList?.map(item => {
                return (
                  <div
                    key={item}
                    className="mt-3 mr-3 rounded-xs bg-(--color-surprise) px-3 py-1 text-(--color-font-surprise)"
                  >
                    {item}
                  </div>
                );
              })}
            </div>
          </div>
          {!vaultKey &&
            undefinedEnvironmentVariableList.some(variableName =>
              variableName.startsWith(`${models.environment.vaultEnvironmentRuntimePath}.`),
            ) && (
              <div className="mt-4">
                <p>
                  These are secret environment variables. However, the required vault key has not been provided yet.
                </p>
                <Button
                  className="cursor- py-1 text-(--color-info) underline ring-1 ring-transparent focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  onPress={() => {
                    setShowInputVaultKeyModal(true);
                    setShowEnvVariableMissingModal(false);
                  }}
                >
                  Click to input vault key
                </Button>
                <div className="flex max-h-80 flex-wrap gap-2 overflow-y-auto">
                  {undefinedEnvironmentVariableList
                    ?.filter(variableName =>
                      variableName.startsWith(`${models.environment.vaultEnvironmentRuntimePath}.`),
                    )
                    .map(item => {
                      return (
                        <div
                          key={item}
                          className="mt-3 mr-3 rounded-xs bg-(--color-surprise) px-3 py-1 text-(--color-font-surprise)"
                        >
                          {item}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
        </VariableMissingErrorModal>
        {showInputVaultKeyModal && <InputVaultKeyModal onClose={() => setShowInputVaultKeyModal(false)} />}
      </div>
    );
  },
);

RequestUrlBar.displayName = 'RequestUrlBar';
