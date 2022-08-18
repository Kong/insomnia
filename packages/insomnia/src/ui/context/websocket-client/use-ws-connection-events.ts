import { useEffect, useState } from 'react';

import { WebsocketEvent } from '../../../main/network/websocket';
import { useWebSocketClient } from './websocket-client-context';

export function useWebSocketConnectionEvents({ responseId }: { responseId: string }) {
  const { event: { findMany, subscribe, clearToSend } } = useWebSocketClient();
  // @TODO - This list can grow to thousands of events in a chatty websocket connection.
  // It's worth investigating an LRU cache that keeps the last X number of messages.
  // We'd also need to expand the findMany API to support pagination.
  const [events, setEvents] = useState<WebsocketEvent[]>([]);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe = () => {
      setEvents([]);
    };

    // @TODO - There is a possible race condition here.
    // Subscribe should probably ask for events after a given event.id so we can make sure
    // we don't lose any.
    async function fetchAndSubscribeToEvents() {
      // Fetch all existing events for this connection
      const allEvents = await findMany({
        responseId,
      });
      if (isMounted) {
        setEvents(allEvents);
      }
      // Subscribe to new events and update the state.
      unsubscribe = subscribe(
        { responseId },
        events => {
          if (isMounted) {
            setEvents(allEvents => allEvents.concat(events));
          }
          window.requestAnimationFrame(clearToSend);
        }
      );

      clearToSend();
    }

    fetchAndSubscribeToEvents();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [responseId, findMany, subscribe, clearToSend]);

  return events;
}
