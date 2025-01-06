import { useCallback, useEffect } from 'react';

import * as models from '../../models';
import { isGrpcRequestId } from '../../models/grpc-request';
import { isEventStreamRequest, isGraphqlSubscriptionRequest, isRequestId } from '../../models/request';
import { isWebSocketRequestId } from '../../models/websocket-request';
import uiEventBus, { UIEventType } from '../eventBus';

export const useCloseConnection = () => {
  // close websocket&grpc&SSE connections
  const closeConnection = useCallback((_: string, ids: 'all' | string[]) => {
    if (ids === 'all') {
      window.main.webSocket.closeAll();
      window.main.grpc.closeAll();
      window.main.curl.closeAll();
      return;
    }

    ids.forEach(async id => {
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
    });
  }, []);

  useEffect(() => {
    uiEventBus.on(UIEventType.CLOSE_TAB, closeConnection);

    return () => {
      uiEventBus.off(UIEventType.CLOSE_TAB, closeConnection);
    };
  }, [closeConnection]);
};
