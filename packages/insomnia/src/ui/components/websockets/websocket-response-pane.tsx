import React, { FC, useEffect, useState } from 'react';
import styled from 'styled-components';

import { WebsocketEvent } from '../../../main/network/websocket';
import { createWebSocketClient } from '../../context/websocket-client/create-websocket-client';
import { useWebSocketConnectionEvents } from '../../context/websocket-client/use-ws-connection-events';
import { WebSocketClientProvider } from '../../context/websocket-client/websocket-client-context';
import { Pane, PaneHeader as OriginalPaneHeader } from '../panes/pane';
import { EventLogTable } from './event-log-table';
import { EventLogView } from './event-log-view';

const PaneHeader = styled(OriginalPaneHeader)({
  '&&': { justifyContent: 'unset' },
});
const PaneBody = styled.div({
  display: 'flex',
  flexDirection: 'column',
});

const PaneBodyTitle = styled.div({
  position: 'relative',
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'space-between',
  background: 'var(--color-bg)',
  color: 'var(--color-font)',
  boxSizing: 'border-box',
  height: 'var(--line-height-sm)',
  alignItems: 'center',
  borderBottom: '1px solid var(--hl-md)',
  paddingRight: 'var(--padding-md)',
  paddingLeft: 'var(--padding-md)',
  flex: 'none',
});
const Title = styled.div({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
});

const PaneBodyContent = styled.div({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
});
const EventLogTableWrapper = styled.div({
  width: '100%',
  flex: 1,
  overflowY: 'scroll',
  padding: 'var(--padding-sm)',
  boxSizing: 'border-box',
});
const EventLogViewWrapper = styled.div({
  flex: 1,
  borderTop: '1px solid var(--hl-md)',
  height: '100%',
  boxSizing: 'content-box',
  padding: 'var(--padding-sm)',
});

export const ResponsePane: FC<{ requestId: string }> = ({
  requestId,
}) => {
  const [selectedEvent, setSelectedEvent] = useState<WebsocketEvent | null>(
    null
  );
  const events = useWebSocketConnectionEvents({ requestId });
  const handleSelection = (event: WebsocketEvent) => {
    setSelectedEvent((selected: WebsocketEvent | null) => selected?._id === event._id ? null : event);
  };

  useEffect(() => {
    setSelectedEvent(null);
  }, []);

  return (
    <Pane type="response">
      <PaneHeader>{}</PaneHeader>
      <PaneBody>
        <PaneBodyTitle>
          <Title>
            Events
          </Title>
        </PaneBodyTitle>
        <PaneBodyContent>
          {Boolean(events?.length) && (
            <EventLogTableWrapper>
              <EventLogTable
                events={events}
                onSelect={handleSelection}
                selectionId={selectedEvent?._id}
              />
            </EventLogTableWrapper>
          )}
          {selectedEvent && (
            <EventLogViewWrapper>
              <EventLogView event={selectedEvent} />
            </EventLogViewWrapper>
          )}
        </PaneBodyContent>
      </PaneBody>
    </ Pane>
  );
};

export const WebSocketResponsePane: FC<{ requestId: string }> = ({ requestId }) => {
  const wsClient = createWebSocketClient();
  return (
    <WebSocketClientProvider client={wsClient}>
      <ResponsePane requestId={requestId} />
    </WebSocketClientProvider>
  );
};
