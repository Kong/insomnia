import { useCallback, useEffect } from 'react';

import { isWebSocketRequestId } from '../../models/websocket-request';
import uiEventBus, { UIEventType } from '../eventBus';

export const useCloseWebSocket = () => {
  const closeWebSocketConnection = useCallback((ids: 'all' | string[]) => {
    if (ids === 'all') {
      window.main.webSocket.closeAll();
      return;
    }

    ids.forEach(id => {
      if (isWebSocketRequestId(id)) {
        window.main.webSocket.close({ requestId: id });
      }
    });
  }, []);

  useEffect(() => {
    uiEventBus.on(UIEventType.CLOSE_TAB, closeWebSocketConnection);

    return () => {
      uiEventBus.off(UIEventType.CLOSE_TAB, closeWebSocketConnection);
    };
  }, [closeWebSocketConnection]);
};
