import { SvgIcon } from 'insomnia-components';
import React, { FC, memo, useCallback, useState } from 'react';
import styled from 'styled-components';

import {
  WebsocketCloseEvent,
  WebsocketErrorEvent,
  WebsocketEvent,
  WebsocketMessageEvent,
  WebsocketOpenEvent,
} from '../../main/network/websocket';
import { CodeEditor } from './codemirror/code-editor';
import { paneBodyClasses } from './panes/pane';

function useWebSocketConnectionEvents({ requestId }: { requestId: string }) {
  // @TODO - This list can grow to thousands of events in a chatty websocket connection.
  // It's worth investigating an LRU cache that keeps the last X number of messages.
  // We'd also need to expand the findMany API to support pagination.
  const [events, setEvents] = React.useState<WebsocketEvent[]>([]);

  React.useEffect(() => {
    let isMounted = true;
    let unsubscribe = () => {};

    // @TODO - There is a possible race condition here.
    // Subscribe should probably ask for events after a given event.id so we can make sure
    // we don't lose any.
    async function fetchAndSubscribeToEvents() {
      // Fetch all existing events for this connection
      const allEvents = await window.main.webSocketConnection.event.findMany({
        requestId,
      });
      if (isMounted) {
        setEvents(allEvents);
      }
      // Subscribe to new events and update the state.
      unsubscribe = window.main.webSocketConnection.event.subscribe(
        { requestId },
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
  }, [requestId]);

  return events;
}

const TableRow = styled('tr')<{ isActive: boolean }>(
  {
    display: 'flex',
    gap: '0.5rem',
  },
  ({ isActive }) => ({
    zIndex: 1,
    borderStyle: 'solid',
    borderColor: isActive ? 'var(--hl-md)' : 'transparent',
    borderWidth:  '1px',
  })
);

export const MessageEventTableRow = memo(
  (props: {
    event: WebsocketMessageEvent;
    isActive: boolean;
    onClick: () => void;
  }) => {
    const { event, isActive, onClick } = props;
    return (
      <TableRow isActive={isActive} onClick={onClick}>
        <td>{event.direction === 'OUTGOING' ? '⬆️' : '⬇️'}</td>
        <td>{event.data.slice(0, 220)}</td>
      </TableRow>
    );
  }
);

MessageEventTableRow.displayName = 'MessageEventTableRow';

export const CloseEventTableRow = memo(
  (props: {
    event: WebsocketCloseEvent;
    isActive: boolean;
    onClick: () => void;
  }) => {
    const { event, isActive, onClick } = props;
    return (
      <TableRow isActive={isActive} onClick={onClick}>
        <td>
          <SvgIcon icon="error" />
        </td>
        <td>
          Connection closed. {event.reason && `Reason: ${event.reason}`}{' '}
          {event.code && `Code: ${event.code}`}
        </td>
      </TableRow>
    );
  }
);

CloseEventTableRow.displayName = 'CloseEventTableRow';

export const OpenEventTableRow = memo(
  (props: {
    event: WebsocketOpenEvent;
    isActive: boolean;
    onClick: () => void;
  }) => {
    const { isActive, onClick } = props;
    return (
      <TableRow isActive={isActive} onClick={onClick}>
        <td>
          <SvgIcon icon="checkmark" />
        </td>
        <td>Connected successfully</td>
      </TableRow>
    );
  }
);

OpenEventTableRow.displayName = 'OpenEventTableRow';

export const ErrorEventTableRow = memo(
  (props: {
    event: WebsocketErrorEvent;
    isActive: boolean;
    onClick: () => void;
  }) => {
    const { event, isActive, onClick } = props;
    return (
      <TableRow isActive={isActive} onClick={onClick}>
        <td>
          <SvgIcon icon="warning" />
        </td>
        <td>{event.message.slice(0, 50)}</td>
      </TableRow>
    );
  }
);

ErrorEventTableRow.displayName = 'ErrorEventTableRow';

export const EventTableRow = memo(
  (props: {
    event: WebsocketEvent;
    isActive: boolean;
    onClick: (event: WebsocketEvent) => void;
  }) => {
    const { event, isActive, onClick } = props;
    const _onClick = useCallback(() => onClick(event), [event, onClick]);

    switch (event.type) {
      case 'message': {
        return (
          <MessageEventTableRow
            event={event}
            isActive={isActive}
            onClick={_onClick}
          />
        );
      }
      case 'open': {
        return (
          <OpenEventTableRow
            event={event}
            isActive={isActive}
            onClick={_onClick}
          />
        );
      }
      case 'close': {
        return (
          <CloseEventTableRow
            event={event}
            isActive={isActive}
            onClick={_onClick}
          />
        );
      }
      case 'error': {
        return (
          <ErrorEventTableRow
            event={event}
            isActive={isActive}
            onClick={_onClick}
          />
        );
      }
      default: {
        return null;
      }
    }
  }
);

EventTableRow.displayName = 'EventTableRow';

const PaneContainer = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
});

const Separator = styled('div')({
  height: '1px',
  background: 'var(--hl-md)',
});

const Section = styled('div')({
  height: '50%',
  display: 'flex',
});

export const WebSocketResponsePane: FC<{ requestId: string }> = ({
  requestId,
}) => {
  const [selectedEvent, setSelectedEvent] = useState<WebsocketEvent | null>(
    null
  );
  const events = useWebSocketConnectionEvents({ requestId });

  return (
    <PaneContainer className={paneBodyClasses}>
      <Section>
        <div style={{ width: '100%' }}>
          {events ? (
            <div className="selectable scrollable" style={{ height: '100%' }}>
              <table className="table--fancy table--striped table--compact">
                <tbody>
                  {events.map(event => (
                    <EventTableRow
                      key={event._id}
                      event={event}
                      isActive={selectedEvent?._id === event._id}
                      onClick={setSelectedEvent}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </Section>
      <Separator />
      <Section>
        {selectedEvent && (
          <CodeEditor
            hideLineNumbers
            mode={'text/plain'}
            defaultValue={JSON.stringify(selectedEvent)}
            uniquenessKey={selectedEvent?._id}
            readOnly
          />
        )}
      </Section>
    </PaneContainer>
  );
};
