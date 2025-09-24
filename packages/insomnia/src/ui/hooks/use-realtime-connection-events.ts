import { useCallback, useEffect, useState } from 'react';

import { REALTIME_EVENTS_CHANNELS } from '~/common/constants';

import type { CurlEvent } from '../../main/network/curl';
import type { McpEvent } from '../../main/network/mcp';
import type { SocketIOEvent } from '../../main/network/socket-io';
import type { WebSocketEvent } from '../../main/network/websocket';

export function useRealtimeConnectionEvents({
  responseId,
  protocol,
}: {
  responseId: string;
  protocol: 'curl' | 'webSocket' | 'socketIO' | 'mcp';
}) {
  const [events, setEvents] = useState<CurlEvent[] | WebSocketEvent[] | SocketIOEvent[] | McpEvent[]>([]);
  const updateEvents = useCallback(async () => {
    const allEvents = await window.main[protocol].event.findMany({ responseId });
    setEvents(allEvents);
  }, [responseId, protocol]);

  useEffect(() => {
    updateEvents();
  }, [updateEvents]);

  useEffect(() => {
    // @ts-expect-error -- we use a dynamic channel here
    const unsubscribe = window.main.on(`${protocol}.${responseId}.${REALTIME_EVENTS_CHANNELS.NEW_EVENT}`, () => {
      // update events when new event message is received
      updateEvents();
    });
    return () => {
      unsubscribe();
    };
  }, [protocol, responseId, updateEvents]);

  return events;
}
