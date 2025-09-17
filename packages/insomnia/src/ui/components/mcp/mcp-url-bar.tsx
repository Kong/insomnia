import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { OverlayContainer } from 'react-aria';
import { Button as RaButton, Heading, Radio, RadioGroup } from 'react-aria-components';
import { useParams } from 'react-router';

import * as projectModel from '~/models/project';
import * as workspaceModel from '~/models/workspace';
import {
  type ConnectActionParams,
  useRequestConnectActionFetcher,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.connect';
import { useRequestGrantAccessFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.grant-access';
import { OneLineEditor, type OneLineEditorHandle } from '~/ui/components/.client/codemirror/one-line-editor';
import { Dropdown, DropdownItem, DropdownSection, ItemContent } from '~/ui/components/base/dropdown';
import { Modal, type ModalHandle } from '~/ui/components/base/modal';
import { ModalHeader } from '~/ui/components/base/modal-header';
import { Button } from '~/ui/components/themed-button';
import { invariant } from '~/utils/invariant';

import { getDataFromKVPair } from '../../../models/environment';
import {
  getById as getMcpRequestById,
  MCP_TRANSPORT_TYPES,
  type McpRequest,
  TRANSPORT_TYPES,
} from '../../../models/mcp-request';
import { tryToInterpolateRequestOrShowRenderErrorModal } from '../../../utils/try-interpolate';
import { useInsomniaTabContext } from '../../context/app/insomnia-tab-context';
import { useRequestPatcher } from '../../hooks/use-request';
import { createKeybindingsHandler, useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { DisconnectButton } from '../websockets/disconnect-button';

interface ActionBarProps {
  request: McpRequest;
  environmentId: string;
  defaultValue: string;
  readyState: boolean;
  onChange: (value: string) => void;
}

const getTransportLabel = (transportType: McpRequest['transportType']) =>
  transportType === TRANSPORT_TYPES.HTTP ? 'HTTP' : 'STDIO';

export const McpUrlActionBar = ({ request, environmentId, defaultValue, onChange, readyState }: ActionBarProps) => {
  const isOpen = readyState;
  const patchRequest = useRequestPatcher();
  const oneLineEditorRef = useRef<OneLineEditorHandle>(null);
  const requestId = request._id;
  const requestTransportType = request.transportType;
  const requestTransportTypeLabel = getTransportLabel(requestTransportType);
  const modalRef = useRef<MCPStdioAccessModalHandle>(null);

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
    return {
      url: rendered.url,
      transportType: request.transportType,
      headers: rendered.headers,
      authentication: rendered.authentication,
      suppressUserAgent: rendered.suppressUserAgent,
      cookieJar: rendered.workspaceCookieJar,
      env: rendered.env,
    };
  }, [environmentId, request]);

  const handleSubmit = useCallback(async () => {
    updateTabById?.(request._id, { temporary: false });
    if (isOpen) {
      window.main.mcp.close({ requestId: request._id });
      return;
    }

    const connectParams = await generateConnectParams();

    if (connectParams.transportType === TRANSPORT_TYPES.STDIO) {
      const stdioAccess = await isAllowedToRunSTDIO(request._id, modalRef);
      if (!stdioAccess) {
        console.log('User denied STDIO access');
        return;
      }
    }

    connectParams && connect(connectParams);
  }, [connect, generateConnectParams, isOpen, request._id, updateTabById]);

  useEffect(() => {
    const sendOnMetaEnter = (event: KeyboardEvent) => {
      if (event.metaKey && event.key === 'Enter') {
        handleSubmit();
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
  }, [handleSubmit]);

  useDocBodyKeyboardShortcuts({
    request_send: () => handleSubmit(),
    request_focusUrl: () => {
      oneLineEditorRef.current?.selectAll();
    },
  });

  const isConnectingOrClosed = !readyState;

  return (
    <>
      {!isOpen && (
        <div className="flex items-center">
          <Dropdown
            triggerButton={
              <RaButton className="pl-2" aria-label="Request Method">
                <span>{requestTransportTypeLabel}</span> <i className="fa fa-caret-down space-left" />
              </RaButton>
            }
            placement="bottom start"
          >
            <DropdownSection>
              {MCP_TRANSPORT_TYPES.map(transportType => (
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
      )}
      {isOpen && (
        <span className="text-success flex items-center pl-[--padding-md]">
          <span className="mr-[--padding-sm] h-2.5 w-2.5 rounded-[50%] bg-[--color-success]" />
          CONNECTED
        </span>
      )}
      <form
        className="flex flex-1"
        aria-disabled={isOpen}
        onSubmit={event => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <div className="box-border h-full w-full px-[--padding-md]">
          <OneLineEditor
            id="websocket-url-bar"
            ref={oneLineEditorRef}
            onKeyDown={createKeybindingsHandler({
              Enter: () => handleSubmit(),
            })}
            readOnly={readyState}
            defaultValue={defaultValue}
            onChange={onChange}
            type="text"
          />
        </div>
        <div className="flex p-1">
          {isConnectingOrClosed ? (
            <button
              className="rounded-sm bg-[--color-surprise] px-[--padding-md] text-center text-[--color-font-surprise] hover:brightness-75"
              disabled={connectRequestFetcher.state === 'submitting' || connectRequestFetcher.state === 'loading'}
              type="submit"
            >
              Discover
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

const isAllowedToRunSTDIO = async (requestId: string, modalRef: React.RefObject<MCPStdioAccessModalHandle>) => {
  const request = await getMcpRequestById(requestId);
  invariant(request, 'Request not found');
  if (request.mcpStdioAccess) {
    return true;
  }
  const workspace = await workspaceModel.getById(request.parentId);
  invariant(workspace, 'Workspace not found for request');
  const project = await projectModel.getById(workspace.parentId);
  invariant(project, 'Project not found for request');
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
        <div className="flex flex-col gap-[var(--padding-lg)]">
          <RadioGroup
            aria-label="Grant access level"
            name="accessLevel"
            className="flex flex-col gap-2"
            value={accessLevel}
            onChange={accessLevel => setAccessLevel(accessLevel as 'request' | 'project')}
          >
            <Radio
              value="request"
              className="flex-1 cursor-pointer rounded border border-solid border-[--hl-md] p-4 transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] focus:outline-none data-[selected]:border-[--color-surprise] data-[disabled]:opacity-25 data-[selected]:ring-2 data-[selected]:ring-[--color-surprise]"
            >
              <div className="flex items-center gap-2">
                <Heading className="text-lg">This MCP client only</Heading>
              </div>
            </Radio>
            <Radio
              value="project"
              className="flex-1 cursor-pointer rounded border border-solid border-[--hl-md] p-4 transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] focus:outline-none data-[selected]:border-[--color-surprise] data-[selected]:ring-2 data-[selected]:ring-[--color-surprise]"
            >
              <div className="flex items-center gap-2">
                <Heading className="text-lg">All MCP clients in this project</Heading>
              </div>
            </Radio>
          </RadioGroup>

          <div className="flex justify-end gap-[var(--padding-sm)] p-[var(--padding-sm)]">
            <Button
              className="rounded-sm border border-solid border-[--hl-md] px-3 py-2 text-[--color-font] transition-colors hover:bg-opacity-90 hover:no-underline"
              isDisabled={isSubmitting}
              data-close-modal="true"
            >
              Deny Access
            </Button>
            <Button
              variant="contained"
              bg="surprise"
              className="gap-[var(--padding-sm)]"
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
