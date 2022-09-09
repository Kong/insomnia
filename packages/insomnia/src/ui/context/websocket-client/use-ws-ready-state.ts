import { useEffect, useState } from 'react';

export enum ReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}
export function useWSReadyState(requestId: string): ReadyState {
  const [readyState, setReadyState] = useState<ReadyState>(ReadyState.CLOSED);

  useEffect(() => {
    window.main.webSocket.readyState.getCurrent({ requestId })
      .then((currentReadyState: ReadyState) => {
        setReadyState(currentReadyState);
      });
  }, [requestId]);

  useEffect(() => {
    const unsubscribe = window.main.on(`webSocket.${requestId}.readyState`,
      (_, incomingReadyState: ReadyState) => {
        setReadyState(incomingReadyState);
      });

    return unsubscribe;
  }, [requestId]);

  return readyState;
}
