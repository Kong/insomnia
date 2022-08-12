import { SvgIcon } from 'insomnia-components';
import React, { FC, memo, useCallback } from 'react';
import styled from 'styled-components';

import {
  WebsocketCloseEvent,
  WebsocketErrorEvent,
  WebsocketEvent,
  WebsocketMessageEvent,
  WebsocketOpenEvent,
} from '../../../main/network/websocket';

const Table = styled.table({
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
  width: '100%',
  padding: 20,
});
const TableWrapper = styled.div({
  overflow: 'auto',
  position: 'relative',
  WebkitUserSelect: 'text',
  cursor: 'text',
  height: '100%',
});
const TableCell = styled('td')(
  {
    border: '1px solid var(--hl-md)',
  },
);
const TableRow = styled('tr')<{ isActive: boolean }>(
  ({ isActive }) => ({
    zIndex: 1,
    backgroundColor: isActive ? 'var(--hl-md)' : 'transparent',
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

interface Props {
  events: WebsocketEvent[];
  selectionId?: string;
  onSelect: (event: WebsocketEvent) => void;
}
export const EventLogTable: FC<Props> = ({ events, onSelect, selectionId }) => {
  return (
    <TableWrapper>
      <Table className="table--fancy table--compact">
        <thead>
          <tr>
            <th style={{ width: 15 }} />
            <th style={{ width: '60%' }}>Data</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {events.map(event => (
            <EventTableRow
              key={event._id}
              event={event}
              isActive={selectionId === event._id}
              onClick={onSelect}
            />
          ))}
        </tbody>
      </Table>
    </TableWrapper>
  );
};
