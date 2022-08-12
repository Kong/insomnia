import React, { FC, useState } from 'react';
import styled from 'styled-components';

import { WebsocketEvent } from '../../../main/network/websocket';
import { useWebSocketConnectionEvents } from '../../context/websocket-client/use-ws-connection-events';
import { EventLogTable } from './event-log-table';
import { EventLogView } from './event-log-view';

const BodyContainer = styled.div({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
});

const TitleWrapper = styled.div({
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
});
const Title = styled.div({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
});

export const WebSocketResponsePane: FC<{ requestId: string }> = ({
  requestId,
}) => {
  const [selectedEvent, setSelectedEvent] = useState<WebsocketEvent | null>(
    null
  );
  const events = useWebSocketConnectionEvents({ requestId });

  const handleSelection = (event: WebsocketEvent) => {
    setSelectedEvent((selected: WebsocketEvent | null) => selected?._id === event._id ? null : event);
  };

  React.useEffect(() => {
    setSelectedEvent(null);
  }, []);

  return (
    <BodyContainer>
      <TitleWrapper>
        Status Code
      </TitleWrapper>
      <TitleWrapper>
        <Title>
          Events
        </Title>
      </TitleWrapper>
      <div style={{ flex: 1, overflowY: 'scroll' }}>
        <div style={{ width: '100%' }}>
          {Boolean(events?.length) && (
            <EventLogTable
              events={events}
              onSelect={handleSelection}
              selectionId={selectedEvent?._id}
            />
          )}
        </div>
      </div>
      {selectedEvent && (<EventLogView event={selectedEvent} />)}
    </BodyContainer>
  );
};
