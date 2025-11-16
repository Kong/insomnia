import { useCallback, useEffect } from 'react';

import { isMcpRequestId } from '~/models/mcp-request';

import * as models from '../../models';
import { isGrpcRequestId } from '../../models/grpc-request';
import { isEventStreamRequest, isGraphqlSubscriptionRequest, isRequestId } from '../../models/request';
import { isSocketIORequestId } from '../../models/socket-io-request';
import { isWebSocketRequestId } from '../../models/websocket-request';
import { useInsomniaTabContext } from '../context/app/insomnia-tab-context';
import uiEventBus from '../event-bus';

// this hook is use for control when to close connections(websocket & SSE & grpc stream & graphql subscription)
export const useCloseConnection = ({ organizationId }: { organizationId: string }) => {
  const closeConnectionById = async (id: string) => {
    if (isGrpcRequestId(id)) {
      globalThis.main.grpc.cancel(id);
    } else if (isWebSocketRequestId(id)) {
      globalThis.main.webSocket.close({ requestId: id });
    } else if (isSocketIORequestId(id)) {
      globalThis.main.socketIO.close({ requestId: id });
    } else if (isRequestId(id)) {
      const request = await models.request.getById(id);
      if (request && isEventStreamRequest(request)) {
        globalThis.main.curl.close({ requestId: id });
      } else if (request && isGraphqlSubscriptionRequest(request)) {
        globalThis.main.webSocket.close({ requestId: id });
      }
    } else if (isMcpRequestId(id)) {
      globalThis.main.mcp.close({ requestId: id });
    }
  };

  // close websocket&grpc&SSE connections
  const handleTabClose = useCallback((_: string, ids: 'all' | string[]) => {
    if (ids === 'all') {
      globalThis.main.webSocket.closeAll();
      globalThis.main.grpc.closeAll();
      globalThis.main.curl.closeAll();
      globalThis.main.mcp.closeAll();
      return;
    }
    for (const id of ids) {
      closeConnectionById(id);
    }
  }, []);

  const { currentOrgTabs } = useInsomniaTabContext();

  const handleActiveEnvironmentChange = useCallback(
    async (workspaceId: string) => {
      const { tabList } = currentOrgTabs;
      const tabs = tabList.filter(tab => tab.workspaceId === workspaceId);
      for (const tab of tabs) {
        closeConnectionById(tab.id);
      }
    },
    [currentOrgTabs],
  );

  useEffect(() => {
    uiEventBus.on('CLOSE_TAB', handleTabClose);
    uiEventBus.on('CHANGE_ACTIVE_ENV', handleActiveEnvironmentChange);

    return () => {
      uiEventBus.off('CLOSE_TAB', handleTabClose);
      uiEventBus.off('CHANGE_ACTIVE_ENV', handleActiveEnvironmentChange);
    };
  }, [handleTabClose, handleActiveEnvironmentChange]);

  // close all connections when organizationId change
  useEffect(() => {
    return () => {
      globalThis.main.webSocket.closeAll();
      globalThis.main.grpc.closeAll();
      globalThis.main.curl.closeAll();
      globalThis.main.socketIO.closeAll();
      globalThis.main.mcp.closeAll();
    };
  }, [organizationId]);
};
