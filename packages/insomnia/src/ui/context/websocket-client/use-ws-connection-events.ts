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
      const allEvents = await window.main.webSocket.event.findMany({ responseId });
      if (isMounted) {
        setEvents(allEvents);
      }

      const afterLatestEvent = (event: WebSocketEvent, prevEvents: WebSocketEvent[]) => {
        if (prevEvents.length === 0) {
          return true;
        }

        return event.timestamp > prevEvents[0]?.timestamp;
      };

      // Subscribe to new events and update the state.
      unsubscribe = window.main.on(`webSocket.${responseId}.event`,
        (_, events: WebSocketEvent[]) => {
          console.log('received events', events);
          if (isMounted) {
            setEvents(prevEvents => events.filter(event => afterLatestEvent(event, prevEvents)).concat(prevEvents));
          }

          // Wait to give the CTS signal until we've rendered a frame.
          // This gives the UI a chance to render and respond to user interactions between receiving events.
          // Note that we do this even if the component isn't mounted, to ensure that CTS gets set even if a race occurs.
          window.requestAnimationFrame(window.main.webSocket.event.clearToSend);
        }
      );

      window.main.webSocket.event.clearToSend();
    }

    fetchAndSubscribeToEvents();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [responseId]);

  return events;
}
