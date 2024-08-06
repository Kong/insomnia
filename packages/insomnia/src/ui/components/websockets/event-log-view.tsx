import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import React, { type FC, useRef } from 'react';
import { Cell, Column, Row, Table, TableBody, TableHeader } from 'react-aria-components';

import type { CurlEvent } from '../../../main/network/curl';
import type { WebSocketEvent } from '../../../main/network/websocket';
import { type IconId, SvgIcon } from '../svg-icon';

const Timestamp: FC<{ time: Date | number }> = ({ time }) => {
  const date = format(time, 'HH:mm:ss');
  return <>{date}</>;
};

interface Props {
  events: (WebSocketEvent | CurlEvent)[];
  selectionId?: string;
  onSelect: (event: WebSocketEvent | CurlEvent) => void;
}

function getIcon(event: WebSocketEvent | CurlEvent): IconId {
  switch (event.type) {
    case 'message': {
      if (event.direction === 'OUTGOING') {
        return 'sent';
      } else {
        return 'receive';
      }
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
    default: {
      return 'bug';
    }
  }
}

const getMessage = (event: WebSocketEvent | CurlEvent): string => {
  switch (event.type) {
    case 'message': {
      if ('data' in event && typeof event.data === 'object') {
        return 'Binary data';
      }
      return event.data.toString();
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
