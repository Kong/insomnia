import { useEffect, useState } from 'react';
import * as reactUse from 'react-use';

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

  useEffect(() => {
    setEvents([]);
  }, [responseId]);

  // TODO: use main process events instead of polling
  reactUse.useInterval(() => {
    let isMounted = true;
    const fn = async () => {
      const allEvents = await window.main[protocol].event.findMany({ responseId });
      if (isMounted) {
        setEvents(allEvents);
      }
    };
    fn();
    return () => {
      isMounted = false;
    };
  }, 500);

  return events;
}
