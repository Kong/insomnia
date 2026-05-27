import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { useParams } from 'react-router';

import { recordProjectRecentRequest } from '~/common/project';
import type { SocketIORequest, WebSocketRequest } from '~/insomnia-data';
import { services } from '~/insomnia-data';
import {
  type ConnectActionParams,
  useRequestConnectActionFetcher,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.connect';
import { OneLineEditor, type OneLineEditorHandle } from '~/ui/components/.client/codemirror/one-line-editor';

import { tryToInterpolateRequestOrShowRenderErrorModal } from '../../../utils/try-interpolate';
import { buildQueryStringFromParams, joinUrlAndQueryString } from '../../../utils/url/querystring';
import { useInsomniaTabContext } from '../../context/app/insomnia-tab-context';
import { createKeybindingsHandler, useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { DisconnectButton } from './disconnect-button';

interface ActionBarProps {
  request: WebSocketRequest | SocketIORequest;
  environmentId: string;
  defaultValue: string;
  readyState: boolean;
  onChange: (value: string) => void;
}

export interface WebSocketActionBarHandle {
  setUrl: (url: string) => void;
}

export const WebSocketActionBar = forwardRef<WebSocketActionBarHandle, ActionBarProps>(
  ({ request, environmentId, defaultValue, onChange, readyState }, ref) => {
    const isOpen = readyState;
    const oneLineEditorRef = useRef<OneLineEditorHandle>(null);
    useLayoutEffect(() => {
      oneLineEditorRef.current?.focusEnd();
    }, []);

    const connectRequestFetcher = useRequestConnectActionFetcher();
    const { organizationId, projectId, workspaceId, requestId } = useParams() as {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      requestId: string;
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
      // Render any Liquid template tags in the url/headers/authentication settings/cookies

      const workspaceCookieJar = await services.cookieJar.getOrCreateForParentId(workspaceId);
      // Render any Liquid template tags in the url/headers/authentication settings/cookies
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
      if (request.type === 'WebSocketRequest' && rendered) {
        return {
          url: joinUrlAndQueryString(rendered.url, buildQueryStringFromParams(rendered.parameters)),
          headers: rendered.headers,
          authentication: rendered.authentication,
          cookieJar: rendered.workspaceCookieJar,
          suppressUserAgent: rendered.suppressUserAgent,
        };
      }

      // socket.io use a separate field (query) for query parameters
      if (request.type === 'SocketIORequest' && rendered) {
        const query: Record<string, string> = {};
        rendered.parameters.forEach(({ name, value }: { name: string; value: string }) => {
          if (name) {
            query[name] = value;
          }
        });
        return {
          url: rendered.url,
          query,
          path: request.settingPath,
          headers: rendered.headers,
          authentication: rendered.authentication,
          cookieJar: rendered.workspaceCookieJar,
          suppressUserAgent: rendered.suppressUserAgent,
        };
      }

      return null;
    }, [environmentId, request, workspaceId]);

    const handleSubmit = useCallback(async () => {
      updateTabById?.(request._id, { temporary: false });
      if (isOpen) {
        if (request.type === 'WebSocketRequest') {
          // If the request is already open, close it
          window.main.webSocket.close({ requestId: request._id });
        } else if (request.type === 'SocketIORequest') {
          window.main.socketIO.close({ requestId: request._id });
        }
        return;
      }
      const connectParams = await generateConnectParams();
      if (connectParams) {
        recordProjectRecentRequest({
          projectId,
          requestId: request._id,
          workspaceId,
        });
        connect(connectParams);
      }
    }, [connect, generateConnectParams, isOpen, projectId, request._id, request.type, updateTabById, workspaceId]);

    const setUrl = useCallback(
      (url: string) => {
        if (oneLineEditorRef.current) {
          oneLineEditorRef.current.setValue(url);
        }
      },
      [oneLineEditorRef],
    );

    useImperativeHandle(ref, () => ({ setUrl }), [setUrl]);

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

    const getRequestLabel = () => {
      let requestTypeLabel = '';
      if (request.type === 'WebSocketRequest') {
        requestTypeLabel = 'WS';
      } else if (request.type === 'SocketIORequest') {
        requestTypeLabel = 'Socket.IO';
      }
      return requestTypeLabel;
    };

    return (
      <>
        {!isOpen && (
          <span className="flex items-center pl-(--padding-md) text-(--color-notice)">{getRequestLabel()}</span>
        )}
        {isOpen && (
          <span className="text-success flex items-center pl-(--padding-md)">
            <span className="mr-(--padding-sm) h-2.5 w-2.5 rounded-[50%] bg-(--color-success)" />
            CONNECTED
          </span>
        )}
        <form
          className="flex flex-1"
          onSubmit={event => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <div className="box-border h-full w-full px-(--padding-md)">
            <OneLineEditor
              id="websocket-url-bar"
              ref={oneLineEditorRef}
              onKeyDown={createKeybindingsHandler({
                Enter: () => handleSubmit(),
              })}
              readOnly={isOpen}
              placeholder="wss://example.com/chat"
              defaultValue={defaultValue}
              onChange={onChange}
              type="text"
            />
          </div>
          <div className="flex p-1">
            {isOpen ? (
              <DisconnectButton requestId={request._id} />
            ) : (
              <button
                className="rounded-xs bg-(--color-surprise) px-(--padding-md) text-center text-(--color-font-surprise) hover:brightness-75"
                type="submit"
              >
                Connect
              </button>
            )}
          </div>
        </form>
      </>
    );
  },
);
