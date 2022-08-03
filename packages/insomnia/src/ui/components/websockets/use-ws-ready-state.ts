import { useState } from 'react';

import { ReadyState } from './types';
import { useWebSocketListener } from './use-websocket-listener';

export function useWSReadyState(requestId: string): ReadyState {
  const [readyState, setReadyState] = useState<ReadyState>(ReadyState.CONNECTING);

  useWebSocketListener<ReadyState>(status => {
    setReadyState(status);
  }, 'websocket:status', requestId);

  return readyState;
}
