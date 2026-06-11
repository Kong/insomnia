import type { AuthTypeOAuth2, McpRequest, Project } from 'insomnia-data';
import { models } from 'insomnia-data';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { OverlayContainer } from 'react-aria';
import { Button as RaButton, Heading, Radio, RadioGroup } from 'react-aria-components';
import { useParams } from 'react-router';
import { useLatest } from 'react-use';

import type { McpReadyState } from '~/main/mcp/types';
import { _buildBearerHeader } from '~/network/authentication';
import { getBasicAuthHeader } from '~/network/basic-auth/get-header';
import { getBearerAuthHeader } from '~/network/bearer-auth/get-header';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import {
  type ConnectActionParams,
  useRequestConnectActionFetcher,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.connect';
import { useRequestGrantAccessFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.grant-access';
import { OneLineEditor, type OneLineEditorHandle } from '~/ui/components/.client/codemirror/one-line-editor';
import { Dropdown, DropdownItem, DropdownSection, ItemContent } from '~/ui/components/base/dropdown';
import { Modal, type ModalHandle } from '~/ui/components/base/modal';
import { ModalHeader } from '~/ui/components/base/modal-header';
import { showModal } from '~/ui/components/modals';
import { AskModal } from '~/ui/components/modals/ask-modal';
import { Button } from '~/ui/components/themed-button';
import { useGitVCSVersion } from '~/ui/hooks/use-vcs-version';
import { getDataFromKVPair } from '~/utils/environment-utils';

import { tryToInterpolateRequestOrShowRenderErrorModal } from '../../../utils/try-interpolate';
import { useInsomniaTabContext } from '../../context/app/insomnia-tab-context';
import { useRequestPatcher } from '../../hooks/use-request';
import { createKeybindingsHandler, useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { DisconnectButton } from '../websockets/disconnect-button';

interface ActionBarProps {
  request: McpRequest;
  project: Project;
  environmentId: string;
  defaultValue: string;
  readyState: McpReadyState;
  onChange: (value: string) => void;
}

const getTransportLabel = (transportType: McpRequest['transportType']) =>
  transportType === models.mcpRequest.TRANSPORT_TYPES.HTTP ? 'HTTP' : 'STDIO';

export const McpUrlActionBar = ({
  request,
  project,
  environmentId,
  defaultValue,
  onChange,
  readyState,
}: ActionBarProps) => {
  // Use readyState as the source of truth, instead of connectRequestFetcher.state, since the fetcher state
  // may not always reflect the true connection state (e.g. switching tabs)
  const isConnected = readyState === 'connected';
  const isConnecting = readyState === 'connecting';
  const isDisconnected = readyState === 'disconnected';
  const patchRequest = useRequestPatcher();
  const oneLineEditorRef = useRef<OneLineEditorHandle>(null);
  const requestId = request._id;
  const requestTransportType = request.transportType;
  const requestTransportTypeLabel = getTransportLabel(requestTransportType);
  const modalRef = useRef<MCPStdioAccessModalHandle>(null);
  const { activeEnvironment, vcsVersion } = useWorkspaceLoaderData()!;
  const gitVersion = useGitVCSVersion();
  // Force re-render when we switch requests, the environment gets modified, or the (Git|Sync)VCS version changes
  const uniqueKey = `${activeEnvironment?.modified}::${requestId}::${gitVersion}::${vcsVersion}`;

  useLayoutEffect(() => {
    oneLineEditorRef.current?.focusEnd();
  }, []);

  const connectRequestFetcher = useRequestConnectActionFetcher();
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const { updateTabById } = useInsomniaTabContext();

  const connect = useCallback(
    (connectParams: ConnectActionParams) => {
      connectRequestFetcher.submit({
        organizationId,
        projectId,
        workspaceId,
        requestId,
        connectParams,
      });
    },
    [connectRequestFetcher, organizationId, projectId, requestId, workspaceId],
  );

  const generateConnectParams = useCallback(async () => {
    // Render any nunjucks tags in the url/headers/authentication settings/cookies
    const rendered = await tryToInterpolateRequestOrShowRenderErrorModal({
      request,
      environmentId,
      payload: {
        url: request.url,
        headers: request.headers,
        authentication: request.authentication,
        env: getDataFromKVPair(request.env).data,
      },
    });

    const { authentication, headers } = rendered;

    if (!authentication.disabled) {
      try {
        if (authentication.type === 'basic') {
          const { username, password, useISO88591 } = authentication;
          const encoding = useISO88591 ? 'latin1' : 'utf8';
          headers.push(getBasicAuthHeader(username, password, encoding));
        } else if (authentication.type === 'bearer' && authentication.token) {
          const { token, prefix } = authentication;
          headers.push(getBearerAuthHeader(token, prefix));
        } else if (authentication.type === 'apikey') {
          const { key, value } = authentication;
          headers.push({ name: key, value });
        } else if (authentication.type === 'oauth2') {
          const oAuth2Token = await window.main.getOAuth2Token(request._id, authentication as AuthTypeOAuth2);
          if (oAuth2Token) {
            const token = oAuth2Token.accessToken;
            const authHeader = _buildBearerHeader(token, authentication.tokenPrefix);
            if (authHeader) {
              headers.push(authHeader);
            }
          }
        }
      } catch (error) {
        console.error('[mcp] Failed to get auth header', error);
      }
    }

    return {
      url: rendered.url,
      transportType: request.transportType,
      headers: headers,
      authentication: rendered.authentication,
      suppressUserAgent: rendered.suppressUserAgent,
      cookieJar: rendered.workspaceCookieJar,
      env: rendered.env,
    };
  }, [environmentId, request]);

  const handleSubmit = useCallback(async () => {
    if (isConnecting) {
      return;
    }

    updateTabById?.(request._id, { temporary: false });
    if (isConnected) {
      window.main.mcp.close({ requestId: request._id });
      return;
    }

    const connectParams = await generateConnectParams();

    if (connectParams.transportType === models.mcpRequest.TRANSPORT_TYPES.STDIO) {
      const stdioAccess = await isAllowedToRunSTDIO(request, project, modalRef);
      if (!stdioAccess) {
        console.log('User denied STDIO access');
        return;
      }
    }

    connectParams && connect(connectParams);
  }, [connect, generateConnectParams, isConnected, isConnecting, project, request, updateTabById]);

  const handleSubmitRef = useLatest(handleSubmit);

  useEffect(() => {
    const sendOnMetaEnter = (event: KeyboardEvent) => {
      if (event.metaKey && event.key === 'Enter') {
        handleSubmitRef.current();
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
  }, [handleSubmitRef]);

  useDocBodyKeyboardShortcuts({
    request_send: () => handleSubmitRef.current(),
    request_focusUrl: () => {
      oneLineEditorRef.current?.selectAll();
    },
  });

  useEffect(() => {
    const unsubscribe = window.main.on('mcp-auth-confirmation', async _ => {
      let answered = false;
      showModal(AskModal, {
        title: 'MCP Authentication Confirmation',
        message: 'The MCP server is requesting OAuth Authorization Flow to proceed. Do you wish to continue?',
        onDone: async (yes: boolean) => {
          if (answered) {
            console.error('Already answered MCP auth confirmation, this should not happen.');
            return;
          }
          answered = true;
          window.main.mcp.authConfirmation(yes);
        },
        onHide: () => {
          if (answered) {
            return;
          }
          answered = true;
          window.main.mcp.authConfirmation(false);
        },
      });
    });
    return unsubscribe;
  }, []);

  return (
    <>
      <div className="flex items-center">
        <Dropdown
          triggerButton={
            <RaButton
              className={`pl-2 ${!isDisconnected ? 'cursor-not-allowed opacity-30' : ''}`}
              aria-label="Request Method"
            >
              <span>{requestTransportTypeLabel}</span> <i className="fa fa-caret-down space-left" />
            </RaButton>
          }
          placement="bottom start"
          isDisabled={!isDisconnected}
        >
          <DropdownSection>
            {models.mcpRequest.MCP_TRANSPORT_TYPES.map(transportType => (
              <DropdownItem key={transportType}>
                <ItemContent
                  label={getTransportLabel(transportType)}
                  onClick={() => patchRequest(request._id, { transportType })}
                />
              </DropdownItem>
            ))}
          </DropdownSection>
        </Dropdown>
      </div>
      <form
        className="flex flex-1"
        aria-disabled={!isDisconnected}
        onSubmit={event => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <div className="box-border h-full w-full px-(--padding-md)">
          <OneLineEditor
            id="mcp-url-bar"
            key={uniqueKey}
            ref={oneLineEditorRef}
            onKeyDown={createKeybindingsHandler({
              Enter: () => handleSubmitRef.current(),
            })}
            readOnly={!isDisconnected}
            defaultValue={defaultValue}
            onChange={onChange}
            type="text"
          />
        </div>
        <div className="flex p-1">
          {!isConnected ? (
            <button
              className="rounded-xs bg-(--color-surprise) px-(--padding-md) text-center text-(--color-font-surprise) hover:brightness-75"
              disabled={isConnecting}
              type="submit"
            >
              Connect
            </button>
          ) : (
            <DisconnectButton requestId={request._id} />
          )}
        </div>
      </form>
      <MCPStdioAccessModal
        ref={modalRef}
        requestId={requestId}
        workspaceId={workspaceId}
        projectId={projectId}
        organizationId={organizationId}
      />
    </>
  );
};

const isAllowedToRunSTDIO = async (
  request: McpRequest,
  project: Project,
  modalRef: React.RefObject<MCPStdioAccessModalHandle>,
) => {
  if (request.mcpStdioAccess) {
    return true;
  }

  if (project.mcpStdioAccess) {
    return true;
  }

  const promise = new Promise(resolve => {
    let granted = false;
    modalRef.current?.show({
      onHide: () => {
        if (!granted) {
          resolve(false);
        }
      },
      onGrant: () => {
        resolve(true);
        granted = true;
      },
    });
  });

  return promise;
};

export interface MCPStdioAccessModalHandle {
  show: ({ onGrant, onHide }: { onGrant: () => void; onHide: () => void }) => void;
}
export const MCPStdioAccessModal = forwardRef<
  MCPStdioAccessModalHandle,
  {
    requestId: string;
    workspaceId: string;
    projectId: string;
    organizationId: string;
  }
>(({ requestId, workspaceId, projectId, organizationId }, ref) => {
  const [accessLevel, setAccessLevel] = React.useState<'request' | 'project'>('request');

  const modalRef = useRef<ModalHandle>(null);
  const onGrantRef = useRef<() => void>(() => {});
  const onHideRef = useRef<() => void>(() => {});

  const requestGrantAccessFetcher = useRequestGrantAccessFetcher();

  const isSubmitting =
    requestGrantAccessFetcher.state === 'submitting' || requestGrantAccessFetcher.state === 'loading';

  const handleHide = () => {
    if (isSubmitting) return;
    onHideRef.current();
    onGrantRef.current = () => {};
    onHideRef.current = () => {};
  };

  const handleGrant = async () => {
    await requestGrantAccessFetcher.submit({
      accessLevel,
      requestId,
      workspaceId,
      projectId,
      organizationId,
    });
    onGrantRef.current();
    modalRef.current?.hide();
  };

  useImperativeHandle(
    ref,
    () => ({
      show: ({ onGrant, onHide }) => {
        onGrantRef.current = onGrant;
        onHideRef.current = onHide;
        modalRef.current?.show();
      },
    }),
    [],
  );

  return (
    <OverlayContainer onClick={e => e.stopPropagation()}>
      <Modal ref={modalRef} onHide={handleHide} keyboardClosable={!isSubmitting} maskClosable={!isSubmitting}>
        <ModalHeader hideCloseButton={isSubmitting}>Grant STDIO access for this MCP Client?</ModalHeader>
        <p>You should be sure you understand and trust this STDIO server before using it.</p>
        <p>Trust and give access to:</p>
        <div className="flex flex-col gap-(--padding-lg)">
          <RadioGroup
            aria-label="Grant access level"
            name="accessLevel"
            className="flex flex-col gap-2"
            value={accessLevel}
            onChange={accessLevel => setAccessLevel(accessLevel as 'request' | 'project')}
          >
            <Radio
              value="request"
              className="flex-1 cursor-pointer rounded-sm border border-solid border-(--hl-md) p-4 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-disabled:opacity-25 data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
            >
              <div className="flex items-center gap-2">
                <Heading className="text-lg">This MCP client only</Heading>
              </div>
            </Radio>
            <Radio
              value="project"
              className="flex-1 cursor-pointer rounded-sm border border-solid border-(--hl-md) p-4 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
            >
              <div className="flex items-center gap-2">
                <Heading className="text-lg">All MCP clients in this project</Heading>
              </div>
            </Radio>
          </RadioGroup>

          <div className="flex justify-end gap-(--padding-sm) p-(--padding-sm)">
            <Button
              className="rounded-xs border border-solid border-(--hl-md) px-3 py-2 text-(--color-font) transition-colors hover:no-underline"
              isDisabled={isSubmitting}
              data-close-modal="true"
            >
              Deny Access
            </Button>
            <Button
              variant="contained"
              bg="surprise"
              className="gap-(--padding-sm)"
              isDisabled={isSubmitting}
              onClick={handleGrant}
            >
              Grant Access
            </Button>
          </div>
        </div>
      </Modal>
    </OverlayContainer>
  );
});
