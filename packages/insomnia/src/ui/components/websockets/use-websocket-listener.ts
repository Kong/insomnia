import { useEffect, useRef } from 'react';

import { FakeWebSocketAPI } from './fake-api';

export type WebSocketChannel = 'websocket:status' | 'websocket:message' | 'websocket:error';

export function useWebSocketListener<CallbackArgs>(
  callback: (args: CallbackArgs) => void,
  channel: WebSocketChannel,
  requestId: string
): void {
  const callbackRef = useRef(callback);

  /**
   * using ref as an instance variable
   * https://reactjs.org/docs/hooks-faq.html#is-there-something-like-instance-variables
   * https://reactjs.org/docs/hooks-faq.html#how-to-read-an-often-changing-value-from-usecallback
   * */
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const listener = (incomingRequestId: string, args: CallbackArgs) => {
      if (incomingRequestId !== requestId) {
        return;
      }

      callbackRef.current?.(args);
    };

    FakeWebSocketAPI.eventEmitter$.on(channel, listener);

    return () => {
      FakeWebSocketAPI.eventEmitter$.off(channel, listener);
    };
  }, [requestId, channel]);
}
