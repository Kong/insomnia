import { useCallback, useEffect, useState } from 'react';

import * as models from '../../../models';
import { WebSocketRequest } from '../../../models/websocket-request';

interface UseWSControl {
  wsRequest: WebSocketRequest | null;
  send: (message: string | Blob | ArrayBufferLike | ArrayBufferView) => void;
  connect: (url: string) => void;
  close: (code?: number, reason?: string) => void;
}

// TODO: replace the window.main.webSocketConnection.methods with client class or object
export function useWSControl(requestId: string): UseWSControl {
  const [wsRequest, setWsRequest] = useState<WebSocketRequest | null>(null);
  const send = useCallback((message: string | Blob | ArrayBufferLike | ArrayBufferView) => {
    window.main.webSocketConnection.event.send({
      requestId,
      // TODO: handle types later
      message,
    });
  }, [requestId]);

  const connect = useCallback(async (url: string) => {
    if (wsRequest) {
      await models.websocketRequest.update(wsRequest, { url });
      await window.main.webSocketConnection.create({ requestId: wsRequest._id });
    }
  }, [wsRequest]);

  const close = useCallback(() => {
    window.main.webSocketConnection.close({ requestId });
  }, [requestId]);

  useEffect(() => {
    models.websocketRequest
      .getById(requestId)
      .then((model: WebSocketRequest | null) => {
        setWsRequest(model);
      });
  }, [requestId]);

  return {
    wsRequest,
    send,
    connect,
    close,
  };
}
