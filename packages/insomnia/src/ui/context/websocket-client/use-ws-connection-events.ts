import { useEffect, useState } from 'react';
import { useInterval } from 'react-use';

import { WebSocketEvent } from '../../../main/network/websocket';

export function useWebSocketConnectionEvents({ responseId }: { responseId: string }) {
  const [events, setEvents] = useState<WebSocketEvent[]>([]);

  useEffect(() => {
    setEvents([]);
  }, [responseId]);

  useInterval(
    () => {
      let isMounted = true;
      const fn = async () => {
        const allEvents = await window.main.webSocket.event.findMany({ responseId });
        if (isMounted) {
          setEvents(allEvents);
        }
      };
      fn();
      return () => {
        isMounted = false;
      };
    },
    500
  );

  return events;
}
