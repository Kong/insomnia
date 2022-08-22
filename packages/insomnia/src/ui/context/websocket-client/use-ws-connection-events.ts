import { useEffect, useState } from 'react';

import { WebSocketEvent } from '../../../main/network/websocket';

export function useWebSocketConnectionEvents({ responseId }: { responseId: string }) {
  // @TODO - This list can grow to thousands of events in a chatty websocket connection.
  // It's worth investigating an LRU cache that keeps the last X number of messages.
  // We'd also need to expand the findMany API to support pagination.
  const [events, setEvents] = useState<WebSocketEvent[]>([]);

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
      const allEvents = await window.main.webSocketConnection.event.findMany({
        responseId,
      });
      if (isMounted) {
        setEvents(allEvents);
      }
      // Subscribe to new events and update the state.
      unsubscribe = window.main.webSocketConnection.event.subscribe(
        { responseId },
        event => {
          if (isMounted) {
            setEvents(events => events.concat([event]));
          }
        }
      );
    }

    fetchAndSubscribeToEvents();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [responseId]);

  return events;
}
