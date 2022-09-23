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
    let isMounted = true;
    window.main.webSocket.readyState.getCurrent({ requestId })
      .then((currentReadyState: ReadyState) => {
        isMounted && setReadyState(currentReadyState);
      });

    const unsubscribe = window.main.on(`webSocket.${requestId}.readyState`,
      (_, incomingReadyState: ReadyState) => {
        isMounted && setReadyState(incomingReadyState);
      });

    return () => {
      isMounted = false;
      unsubscribe();
    };

  }, [requestId]);

  return readyState;
}
