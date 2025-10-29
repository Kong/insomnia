import { useEffect, useState } from 'react';

import { REALTIME_EVENTS_CHANNELS } from '~/common/constants';
import type { McpReadyState } from '~/main/network/mcp';

export function useMcpReadyState({ requestId }: { requestId: string }): McpReadyState {
  const [readyState, setReadyState] = useState<McpReadyState>('disconnected');

  // get readyState when requestId changes
  useEffect(() => {
    let isMounted = true;
    const fn = async () => {
      window.main.mcp.readyState.getCurrent({ requestId }).then(currentReadyState => {
        isMounted && setReadyState(currentReadyState);
      });
    };
    fn();
    return () => {
      isMounted = false;
    };
  }, [requestId]);
  // listen for readyState changes
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = window.main.on(
      // @ts-expect-error -- we use a dynamic channel here
      `mcp.${requestId}.${REALTIME_EVENTS_CHANNELS.READY_STATE}`,
      (_, incomingReadyState: McpReadyState) => {
        isMounted && setReadyState(incomingReadyState);
      },
    );
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [requestId]);

  return readyState;
}
