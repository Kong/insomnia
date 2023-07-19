import { useEffect, useState } from 'react';
import { useInterval } from 'react-use';

export enum ReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

export function useReadyState({ requestId, protocol }: { requestId: string; protocol: 'curl' | 'webSocket' }): boolean | ReadyState {
  const [readyState, setReadyState] = useState<boolean | ReadyState>(false);

  useEffect(() => {
    setReadyState(false);
  }, [requestId]);

  useInterval(
    () => {
      let isMounted = true;
      const fn = async () => {
        window.main[protocol].readyState.getCurrent({ requestId })
          .then((currentReadyState: boolean | ReadyState) => {
            isMounted && setReadyState(currentReadyState);
          });
      };
      fn();
      const unsubscribe = window.main.on(`${protocol}.${requestId}.readyState`,
        (_, incomingReadyState: boolean) => {
          isMounted && setReadyState(incomingReadyState);
        });
      return () => {
        isMounted = false;
        unsubscribe();
      };
    },
    500
  );

  return readyState;
}
