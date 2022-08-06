import { useEffect, useState } from 'react';

import { WebsocketEvent } from '../../../main/network/websocket';

export function useWSEvent(requestId: string): WebsocketEvent | null {
  const [event, setEvent] = useState<WebsocketEvent | null>(null);

  useEffect(() => {
    const unsubscribe = window.main.webSocketConnection.event.subscribe(
      { requestId },
      (incomingEvent: WebsocketEvent) => {
        setEvent(incomingEvent);
      }
    );

    return unsubscribe;
  }, [requestId]);

  return event;
}
