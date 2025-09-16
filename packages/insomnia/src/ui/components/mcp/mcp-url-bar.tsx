import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Button } from 'react-aria-components';
import { useParams } from 'react-router';

import {
  type ConnectActionParams,
  useRequestConnectActionFetcher,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.connect';
import { OneLineEditor, type OneLineEditorHandle } from '~/ui/components/.client/codemirror/one-line-editor';
import { Dropdown, DropdownItem, DropdownSection, ItemContent } from '~/ui/components/base/dropdown';

import { getDataFromKVPair } from '../../../models/environment';
import { MCP_TRANSPORT_TYPES, type McpRequest, TRANSPORT_TYPES } from '../../../models/mcp-request';
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
              <Button className="pl-2" aria-label="Request Method">
                <span>{requestTransportTypeLabel}</span> <i className="fa fa-caret-down space-left" />
              </Button>
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
    </>
  );
};
