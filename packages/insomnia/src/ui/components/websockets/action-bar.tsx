import React, { type FC, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useFetcher, useParams } from 'react-router-dom';

import * as models from '../../../models';
import type { WebSocketRequest } from '../../../models/websocket-request';
import { tryToInterpolateRequestOrShowRenderErrorModal } from '../../../utils/try-interpolate';
import { buildQueryStringFromParams, joinUrlAndQueryString } from '../../../utils/url/querystring';
import type { ConnectActionParams } from '../../routes/request';
import { OneLineEditor, type OneLineEditorHandle } from '../codemirror/one-line-editor';
import { createKeybindingsHandler, useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { DisconnectButton } from './disconnect-button';

interface ActionBarProps {
  request: WebSocketRequest;
  environmentId: string;
  defaultValue: string;
  readyState: boolean;
  onChange: (value: string) => void;
}

export const WebSocketActionBar: FC<ActionBarProps> = ({ request, environmentId, defaultValue, onChange, readyState }) => {
  const isOpen = readyState;
  const oneLineEditorRef = useRef<OneLineEditorHandle>(null);
  useLayoutEffect(() => {
    oneLineEditorRef.current?.focusEnd();
  }, []);

  const fetcher = useFetcher();
  const { organizationId, projectId, workspaceId, requestId } = useParams() as { organizationId: string; projectId: string; workspaceId: string; requestId: string };

  const connect = useCallback((connectParams: ConnectActionParams) => {
    fetcher.submit(JSON.stringify(connectParams), {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/connect`,
      method: 'post',
      encType: 'application/json',
    });
  }, [fetcher, organizationId, projectId, requestId, workspaceId]);

  const handleSubmit = useCallback(async () => {
    if (isOpen) {
      window.main.webSocket.close({ requestId: request._id });
      return;
    }
    // Render any nunjucks tags in the url/headers/authentication settings/cookies

    const workspaceCookieJar = await models.cookieJar.getOrCreateForParentId(workspaceId);
    // Render any nunjucks tags in the url/headers/authentication settings/cookies
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
    rendered && connect({
      url: joinUrlAndQueryString(rendered.url, buildQueryStringFromParams(rendered.parameters)),
      headers: rendered.headers,
      authentication: rendered.authentication,
      cookieJar: rendered.workspaceCookieJar,
      suppressUserAgent: rendered.suppressUserAgent,
    });
  }, [connect, environmentId, isOpen, request, workspaceId]);

  useEffect(() => {
    const sendOnMetaEnter = (event: KeyboardEvent) => {
      if (event.metaKey && event.key === 'Enter') {
        handleSubmit();
      }
    };
    document.getElementById('sidebar-request-gridlist')?.addEventListener('keydown', sendOnMetaEnter, { capture: true });
    return () => {
      document.getElementById('sidebar-request-gridlist')?.removeEventListener('keydown', sendOnMetaEnter, { capture: true });
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
        <span className="text-[--color-notice] flex items-center pl-[--padding-md]">WS</span>
      )}
      {isOpen && (
        <span className="text-success flex items-center pl-[--padding-md]">
          <span className="bg-[--color-success] mr-[--padding-sm] w-2.5 h-2.5 rounded-[50%]" />
          CONNECTED
        </span>
      )}
      <form
        className="flex-1 flex"
        aria-disabled={isOpen}
        onSubmit={event => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <div className="box-border w-full h-full px-[--padding-md]">
          <OneLineEditor
            id="websocket-url-bar"
            ref={oneLineEditorRef}
            onKeyDown={createKeybindingsHandler({
              Enter: () => handleSubmit(),
            })}
            readOnly={readyState}
            placeholder="wss://example.com/chat"
            defaultValue={defaultValue}
            onChange={onChange}
            type="text"
          />
        </div>
        <div className="flex p-1">
          {isConnectingOrClosed ? (
            <button
              className="hover:brightness-75 rounded-sm px-[--padding-md] text-center bg-[--color-surprise] text-[--color-font-surprise]"
              type="submit"
            >
              Connect
            </button>
          ) : (
            <DisconnectButton requestId={request._id} />
          )}
        </div>
      </form>
    </>
  );
};
