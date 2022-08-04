import { useEffect, useState } from 'react';

import { ReadyState } from './types';

export function useWSReadyState(requestId: string): ReadyState {
  const [readyState, setReadyState] = useState<ReadyState>(ReadyState.CONNECTING);

  useEffect(() => {
    const unsubscribe = window.main.webSocketConnection.readyState.subscribe(
      { requestId },
      (incomingReadyState: ReadyState) => {
        setReadyState(incomingReadyState);
      }
    );

    return unsubscribe;
  }, [requestId]);

  return readyState;
}
