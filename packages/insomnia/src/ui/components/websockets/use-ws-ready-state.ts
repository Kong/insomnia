import { useEffect, useState } from 'react';

import { ReadyState } from './types';
import { useWebSocketClient } from './websocket-client-context';

export function useWSReadyState(requestId: string): ReadyState {
  const [readyState, setReadyState] = useState<ReadyState>(ReadyState.CONNECTING);
  const { onReadyState } = useWebSocketClient();

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
