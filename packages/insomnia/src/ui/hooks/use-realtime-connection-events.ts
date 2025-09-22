import { useCallback, useEffect, useState } from 'react';

import type { CurlEvent } from '../../main/network/curl';
import type { SocketIOEvent } from '../../main/network/socket-io';
import type { WebSocketEvent } from '../../main/network/websocket';

export function useRealtimeConnectionEvents({
  responseId,
  protocol,
}: {
  responseId: string;
  protocol: 'curl' | 'webSocket' | 'socketIO';
}) {
  const [events, setEvents] = useState<CurlEvent[] | WebSocketEvent[] | SocketIOEvent[]>([]);
  const updateEvents = useCallback(async () => {
    const allEvents = await window.main[protocol].event.findMany({ responseId });
    setEvents(allEvents);
  }, [responseId, protocol]);

  useEffect(() => {
    updateEvents();
  }, [updateEvents]);

  useEffect(() => {
    let isMounted = true;
    // @ts-expect-error -- we use a dynamic channel here+
    const unsubscribe = window.main.on(`${protocol}.${responseId}.newEventReceived`, () => {
      // update events when new event message is received
      if (isMounted) {
        updateEvents();
      }
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [protocol, responseId, updateEvents]);

  return events;
}
