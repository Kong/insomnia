import { useCallback, useEffect } from 'react';

import * as models from '../../models';
import { isGrpcRequestId } from '../../models/grpc-request';
import { isEventStreamRequest, isGraphqlSubscriptionRequest, isRequestId } from '../../models/request';
import { isWebSocketRequestId } from '../../models/websocket-request';
import { useInsomniaTabContext } from '../context/app/insomnia-tab-context';
import uiEventBus from '../eventBus';

// this hook is use for control when to close connections(websocket & SSE & grpc stream & graphql subscription)
export const useCloseConnection = ({ organizationId }: { organizationId: string }) => {

  const closeConnectionById = async (id: string) => {
    if (isGrpcRequestId(id)) {
      window.main.grpc.cancel(id);
    } else if (isWebSocketRequestId(id)) {
      window.main.webSocket.close({ requestId: id });
    } else if (isRequestId(id)) {
      const request = await models.request.getById(id);
      if (request && isEventStreamRequest(request)) {
        window.main.curl.close({ requestId: id });
      } else if (request && isGraphqlSubscriptionRequest(request)) {
        window.main.webSocket.close({ requestId: id });
      }
    }
  };

  // close websocket&grpc&SSE connections
  const handleTabClose = useCallback((_: string, ids: 'all' | string[]) => {
    if (ids === 'all') {
      window.main.webSocket.closeAll();
      window.main.grpc.closeAll();
      window.main.curl.closeAll();
      return;
    }

    ids.forEach(async id => {
      await closeConnectionById(id);
    });
  }, []);

  const { currentOrgTabs } = useInsomniaTabContext();

  const handleActiveEnvironmentChange = useCallback((workspaceId: string) => {
    const { tabList } = currentOrgTabs;
    const tabs = tabList.filter(tab => tab.workspaceId === workspaceId);
    tabs.forEach(async tab => {
      const id = tab.id;
      await closeConnectionById(id);
    });
  }, [currentOrgTabs]);

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
      window.main.webSocket.closeAll();
      window.main.grpc.closeAll();
      window.main.curl.closeAll();
    };
  }, [organizationId]);
};
