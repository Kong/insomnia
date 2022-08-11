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
import { Pane, paneBodyClasses, PaneHeader } from './panes/pane';
import { StatusTag } from './tags/status-tag';

// const TitleWrapper = styled.div({
//   position: 'relative',
//   display: 'flex',
//   flexDirection: 'row',
//   justifyContent: 'space-between',
//   background: 'var(--color-bg)',
//   color: 'var(--color-font)',
//   boxSizing: 'border-box',
//   height: 'var(--line-height-sm)',
//   alignItems: 'stretch',
//   borderBottom: '1px solid var(--hl-md)',
// });
// const Title = styled.div({
//   display: 'flex',
//   justifyContent: 'center',
//   alignItems: 'center',
//   paddingRight: 'var(--padding-md)',
//   paddingLeft: 'var(--padding-md)',
// });

const BodyContainer = styled.div({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
});
const ButtonWrapper = styled.div({
  paddingTop: 3,
  paddingBottom: 3,
});
const EditorWrapper = styled.form({
  width: '100%',
  height: '100%',
  position: 'relative',
  boxSizing: 'border-box',
});
const SendButton = styled.button({
  padding: '0 var(--padding-md)',
  height: '100%',
  border: '1px solid var(--hl-lg)',
  borderRadius: 'var(--radius-md)',
  ':hover': {
    backgroundColor: 'var(--hl-xs)',
  },
  // marginTop: 'var(--padding-md)',
  // marginBottom: 'var(--padding-md)',
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
const StretchedPaneHeader = styled(PaneHeader)({
  '&&': { alignItems: 'stretch' },
});

const EventLogTable = styled.table({
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
  width: '100%',
  padding: 20,
});

const StyledStatus = styled(StatusTag)({
  alignItems: 'center',
  '&& > .tag': {
    alignItems: 'center',
  },
});

function useWebSocketConnectionEvents({ requestId }: { requestId: string }) {
  // @TODO - This list can grow to thousands of events in a chatty websocket connection.
  // It's worth investigating an LRU cache that keeps the last X number of messages.
  // We'd also need to expand the findMany API to support pagination.
  const [events, setEvents] = React.useState<WebsocketEvent[]>([]);
  const [statusCode, setStatusCode] = React.useState<number>();

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
          if (event.type === 'upgrade') {
            setStatusCode(event.statusCode);
          } else if (event.type === 'close') {
            setStatusCode(event.code);
          }

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

  React.useEffect(() => {
    setStatusCode();
  }, []);

  return [statusCode, events];
}

const TableCell = styled('td')(
  {
    border: '1px solid var(--hl-md)',
  },
);

const TableRow = styled('tr')<{ isActive: boolean }>(
  // {
  //   border: '1px solid var(--hl-md)',
  // },
  ({ isActive }) => ({
    zIndex: 1,
    // borderStyle: 'solid',
    backgroundColor: isActive ? 'var(--hl-md)' : 'transparent',
    // borderWidth:  '1px',
  })
);

const TableCellTextWrapper = styled.div({
  width: 'inherit',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

const TableCellIconWrapper = styled.div({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
});

export const MessageEventTableRow = memo(
  (props: {
    event: WebsocketMessageEvent;
    isActive: boolean;
    onClick: () => void;
  }) => {
    const { event, isActive, onClick } = props;
    return (
      <TableRow isActive={isActive} onClick={onClick}>
        <TableCell>
          <TableCellIconWrapper>
            {event.direction === 'OUTGOING' ? <SvgIcon icon="sent" /> : <SvgIcon icon="receive" />}    
          </TableCellIconWrapper>
        </TableCell>
        <TableCell>
          <TableCellTextWrapper>
            {event.data}
          </TableCellTextWrapper>
        </TableCell>
        <TableCell>{event.timestamp}</TableCell>
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
        <TableCell>
          <TableCellIconWrapper>
            <SvgIcon icon="disconnected" />
          </TableCellIconWrapper>
        </TableCell>
        <TableCell>
          <TableCellTextWrapper>
            Connection closed. {event.reason && `Reason: ${event.reason}`}{' '}
            {event.code && `Code: ${event.code}`}
          </TableCellTextWrapper>
        </TableCell>
        <TableCell>{event.timestamp}</TableCell>
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
        <TableCell>
          <TableCellIconWrapper>
            <SvgIcon icon="ellipsis-circle2" />
          </TableCellIconWrapper>
        </TableCell>
        <TableCell>
          <TableCellTextWrapper>
            Connected successfully
          </TableCellTextWrapper>
        </TableCell>
        <TableCell>{props.event.timestamp}</TableCell>
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
        <TableCell>
          <TableCellIconWrapper>
            <SvgIcon icon="error" />
          </TableCellIconWrapper>
        </TableCell>
        <TableCell>{event.message.slice(0, 50)}</TableCell>
        <TableCell>{event.timestamp}</TableCell>
      </TableRow>
    );
  }
);

ErrorEventTableRow.displayName = 'ErrorEventTableRow';

const SearchInput = styled.input({
  border: '1px solid var(--hl-md)',
  padding: 'var(--padding-xs)',
  borderRadius: 'var(--radius-md)',
  // backgroundColor: 'var(--hl-xxs)',
});

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

export const WebSocketResponsePane: FC<{ requestId: string }> = ({
  requestId,
}) => {
  const [selectedEvent, setSelectedEvent] = useState<WebsocketEvent | null>(
    null
  );
  const [statusCode, events] = useWebSocketConnectionEvents({ requestId });

  const handleSelection = (event: WebsocketEvent) => {
    if (event._id === selectedEvent?._id) {
      setSelectedEvent(null);
      // return;
    } else {
      setSelectedEvent(event);
    }
  };

  React.useEffect(() => {
    setSelectedEvent();
  }, []);

  return (
    <BodyContainer>
      <TitleWrapper>
        {statusCode && <StyledStatus statusCode={statusCode} />}
      </TitleWrapper>
      <TitleWrapper>
        <Title>
          Events
        </Title>
        <SearchInput type="text" placeholder="Search" />
      </TitleWrapper>
      <div style={{ flex: 1, overflowY: 'scroll' }}>
        <div style={{ width: '100%' }}>
          {events?.length ? (
            <div className="selectable scrollable" style={{ height: '100%', padding: 10 }}>
              <EventLogTable className="table--fancy table--compact">
                <thead>
                  <th style={{ width: 15 }} />
                  <th style={{ width: '60%' }}>Data</th>
                  <th>Time</th>
                </thead>
                <tbody>
                  {events.map(event => (
                    <EventTableRow
                      key={event._id}
                      event={event}
                      isActive={selectedEvent?._id === event._id}
                      onClick={handleSelection}
                    />
                  ))}
                </tbody>
              </EventLogTable>
            </div>
          ) : null}
        </div>
      </div>
      {
        selectedEvent && (<div style={{ flex: 1, borderTop: '1px solid var(--hl-md)' }}>
          <EditorWrapper id="websocketMessageForm">
            <div style={{ height: '100%', padding: 10 }}>
              <CodeEditor
                hideLineNumbers
                mode={'text/plain'}
                defaultValue={JSON.stringify(selectedEvent)}
                uniquenessKey={selectedEvent?._id}
                readOnly
              />
            </div>
          </EditorWrapper>
        </div>)
      }
    </BodyContainer>
  );
};
