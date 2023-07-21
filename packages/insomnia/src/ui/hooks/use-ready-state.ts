import { useEffect, useState } from 'react';

export enum ReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

export function useReadyState({ requestId, protocol }: { requestId: string; protocol: 'curl' | 'webSocket' }): boolean {
  const [readyState, setReadyState] = useState<boolean>(false);

  // get readyState when requestId or protocol changes
  useEffect(() => {
    let isMounted = true;
    const fn = async () => {
      window.main[protocol].readyState.getCurrent({ requestId })
        .then((currentReadyState: boolean) => {
          isMounted && setReadyState(currentReadyState);
        });
    };
    fn();
    return () => {
      isMounted = false;
    };
  }, [protocol, requestId]);
  // listen for readyState changes
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = window.main.on(`${protocol}.${requestId}.readyState`,
      (_, incomingReadyState: boolean) => {
        isMounted && setReadyState(incomingReadyState);
      });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [protocol, requestId]);

  return readyState;
}
