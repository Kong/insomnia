import { useEffect } from 'react';

import { FakeWebSocketAPI } from './fake-api';

interface UseWSControl {
  send: (message: string | Blob | ArrayBufferLike | ArrayBufferView) => void;
  connect: (url: string) => void;
  close: (code?: number, reason?: string) => void;
}

export function useWSControl(requestId: string): UseWSControl {
  const send = (message: string | Blob | ArrayBufferLike | ArrayBufferView) => {
    FakeWebSocketAPI.messageWebsocket({ requestId, message });
  };

  const connect = (uri: string) => {
    FakeWebSocketAPI.openWebsocket(uri, requestId);
  };

  const close = (code?: number, reason?: string) => {
    FakeWebSocketAPI.closeWebsocket(requestId, code, reason);
  };

  useEffect(() => {
    FakeWebSocketAPI.closeWebsocket(requestId);
  }, [requestId]);

  return {
    send,
    connect,
    close,
  };
}
