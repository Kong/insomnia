import { useCallback } from 'react';

import * as models from '../../../models';

interface UseWSControl {
  send: (message: string | Blob | ArrayBufferLike | ArrayBufferView) => void;
  connect: (url: string) => void;
  close: (code?: number, reason?: string) => void;
}

// TODO: replace the window.main.webSocketConnection.methods with client class or object
export function useWSControl(requestId: string): UseWSControl {
  const send = useCallback((message: string | Blob | ArrayBufferLike | ArrayBufferView) => {
    window.main.webSocketConnection.event.send({
      requestId,
      // TODO: handle types later
      message: JSON.stringify(message),
    });
  }, [requestId]);

  const connect = useCallback(async (url: string) => {
    const wsr = await models.websocketRequest.getById(requestId);
    if (wsr) {
      await models.websocketRequest.update(wsr, { url });
      await window.main.webSocketConnection.create({ requestId });
    }
  }, [requestId]);

  const close = useCallback(() => {
    window.main.webSocketConnection.close({ requestId });
  }, [requestId]);

  return {
    send,
    connect,
    close,
  };
}
