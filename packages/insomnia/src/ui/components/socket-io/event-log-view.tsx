import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import React, { type FC, useRef } from 'react';
import { Cell, Column, Row, Table, TableBody, TableHeader } from 'react-aria-components';

import type { SocketIOEvent } from '../../../main/network/socket-io';
import { type IconId, SvgIcon } from '../svg-icon';

const Timestamp: FC<{ time: Date | number }> = ({ time }) => {
  const date = format(time, 'HH:mm:ss');
  return <>{date}</>;
};

interface Props {
  events: (SocketIOEvent)[];
  selectionId?: string;
  onSelect: (event: SocketIOEvent) => void;
}

function getIcon(event: SocketIOEvent): IconId {
  switch (event.type) {
    case 'message': {
      if (event.direction === 'OUTGOING') {
        return 'sent';
      }
      return 'receive';

    }
    case 'open': {
      return 'checkmark-circle';
    }
    case 'close': {
      return 'disconnected';
    }
    case 'error': {
      return 'error';
    }
    case 'addEvent': {
      return 'info';
    }
    case 'removeEvent': {
      return 'info';
    }
    case 'info': {
      return 'info';
    }
    default: {
      return 'bug';
    }
  }
}

const getMessage = (event: SocketIOEvent): string | JSX.Element => {
  switch (event.type) {
    case 'message': {
      return (
        <div className='flex items-center'>
          <span className='mr-2 bg-success py-1 px-2 rounded-sm'>{event.eventName}</span>
          <span className='flex-shrink'>{event?.data?.[0]?.toString()}</span>
          {event?.data?.length > 1 && <span className='bg-info ml-2 py-1 px-2 rounded-md'>+{event.data.length - 1} {event.data.length - 1 > 1 ? 'Args' : 'Arg'}</span>}
        </div>
      );
    }
    case 'open': {
      return 'Connected successfully';
    }
    case 'close': {
      return 'Disconnected';
    }
    case 'error': {
      return event.message;
    }
    case 'addEvent': {
      return `Listening to event: ${event.eventName}`;
    }
    case 'removeEvent': {
      return `Stopped listening to event: ${event.eventName}`;
    }
    case 'info': {
      return event.message;
    }
    default: {
      return 'Unknown event';
    }
  }
};

export const EventLogView: FC<Props> = ({ events, onSelect, selectionId }) => {
  const parentRef = useRef<HTMLTableSectionElement>(null);
  const virtualizer = useVirtualizer({
    getScrollElement: () => parentRef.current,
    count: events.length,
    estimateSize: React.useCallback(() => 30, []),
    overscan: 30,
    getItemKey: index => events[index]._id,
  });

  return (
    <>
      <div className='w-full flex-1 overflow-hidden border border-solid border-[--hl-sm] select-none overflow-y-auto max-h-96'>
        <Table
          selectionMode='single'
          selectedKeys={selectionId ? [selectionId] : []}
          selectionBehavior='replace'
          onSelectionChange={keys => {
            if (keys !== 'all') {
              const key = keys.values().next().value;

              const event = events.find(e => e._id === key);

              if (event) {
                onSelect(event);
              }
            }
          }}
          aria-label='Modified objects'
          className="border-separate border-spacing-0 w-full"
        >
          <TableHeader className='sticky top-0 z-10 backdrop-blur backdrop-filter bg-[--hl-xs]'>
            <Column isRowHeader className="p-3 text-left text-xs font-semibold  focus:outline-none">
              <span />
            </Column>
            <Column className="p-3 text-left text-xs font-semibold focus:outline-none">
              Data
            </Column>
            <Column className="p-3 text-left text-xs font-semibold focus:outline-none">
              Time
            </Column>
          </TableHeader>
          <TableBody
            style={{ height: virtualizer.getTotalSize() }}
            ref={parentRef}
            className="divide divide-[--hl-sm] divide-solid"
            items={virtualizer.getVirtualItems()}
          >
            {item => {
              const event = events[item.index];
              return (
                <Row className="group focus:outline-none focus-within:bg-[--hl-sm] transition-colors">
                  <Cell className="p-2 whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                    <SvgIcon icon={getIcon(event)} />
                  </Cell>
                  <Cell className="whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                    {getMessage(event)}
                  </Cell>
                  <Cell className="whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                    <Timestamp time={event.timestamp} />
                  </Cell>
                </Row>
              );
            }}
          </TableBody>
        </Table>
      </div>
    </>
  );
};
