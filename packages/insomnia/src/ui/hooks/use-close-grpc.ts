import { useCallback, useEffect } from 'react';

import { isGrpcRequestId } from '../../models/grpc-request';
import uiEventBus, { UIEventType } from '../eventBus';

export const useCloseGrpc = () => {
  const closeGrpcConnection = useCallback((ids: 'all' | string[]) => {
    if (ids === 'all') {
      window.main.webSocket.closeAll();
      return;
    }

    ids.forEach(id => {
      if (isGrpcRequestId(id)) {
        window.main.grpc.cancel(id);
      }
    });
  }, []);

  useEffect(() => {
    uiEventBus.on(UIEventType.CLOSE_TAB, closeGrpcConnection);

    return () => {
      uiEventBus.off(UIEventType.CLOSE_TAB, closeGrpcConnection);
    };
  }, [closeGrpcConnection]);
};
