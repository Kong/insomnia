import { useEffect, useState } from 'react';

import { ReadyState } from './types';

export function useWSReadyState(requestId: string): ReadyState {
  const [readyState, setReadyState] = useState<ReadyState>(ReadyState.CONNECTING);

  useEffect(() => {
    window.main.webSocketConnection.readyState.subscribe(
      { requestId },
      (incomingReadyState: ReadyState) => {
        setReadyState(incomingReadyState);
      }
    );
  }, [requestId]);

  return readyState;
}
