import { useEffect, useState } from 'react';

import { useWebSocketClient } from './websocket-client-context';

export enum ReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}
export function useWSReadyState(requestId: string): ReadyState {
  const [readyState, setReadyState] = useState<ReadyState>(ReadyState.CONNECTING);
  const { onReadyState, getReadyState } = useWebSocketClient();

  useEffect(() => {
    getReadyState({ requestId })
      .then((currentReadyState: ReadyState) => {
        setReadyState(currentReadyState);
      });
  }, [getReadyState, requestId]);

  useEffect(() => {
    const unsubscribe = onReadyState(
      { requestId },
      (incomingReadyState: ReadyState) => {
        setReadyState(incomingReadyState);
      }
    );

    return unsubscribe;
  }, [onReadyState, requestId]);

  return readyState;
}
