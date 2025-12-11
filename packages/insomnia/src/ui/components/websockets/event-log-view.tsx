import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import React, { type FC, useEffect, useRef, useState } from 'react';
import { Button, Cell, Column, Row, Table, TableBody, TableHeader } from 'react-aria-components';

import { HelpTooltip } from '~/ui/components/help-tooltip';
import { Icon } from '~/ui/components/icon';

import { METHOD_UNKNOWN, NOTIFICATIONS_LIST_CHANGED, unsupportedMethodPrefix } from '../../../common/mcp-utils';
import type { McpEvent } from '../../../main/mcp/types';
import type { CurlEvent } from '../../../main/network/curl';
import type { SocketIOEvent } from '../../../main/network/socket-io';
import type { WebSocketEvent } from '../../../main/network/websocket';
import { type IconId, SvgIcon } from '../svg-icon';

type EventTypes = WebSocketEvent | CurlEvent | SocketIOEvent | McpEvent;
const Timestamp: FC<{ time: Date | number }> = ({ time }) => {
  const date = format(time, 'HH:mm:ss');
  return <>{date}</>;
};

interface Props {
  events: EventTypes[];
  selectionId?: string;
  onSelect: (event: EventTypes) => void;
  autoSelectLatestEvent?: boolean;
  readyState?: boolean;
  protocol?: 'curl' | 'webSocket' | 'socketIO' | 'mcp';
}

const isSocketIOEvent = (event: EventTypes): event is SocketIOEvent => {
  return 'eventName' in event && typeof event.eventName === 'string';
};

const isMcpEvent = (event: EventTypes): event is McpEvent => event._id.toString().startsWith('mcp-');

function getIcon(event: EventTypes): IconId {
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
    case 'notification': {
      return 'receive';
    }
    default: {
      return 'bug';
    }
  }
}

const getMessage = (event: EventTypes, isLoading: boolean): string | JSX.Element => {
  switch (event.type) {
    case 'message': {
      if (isSocketIOEvent(event)) {
        return (
          <div className="flex items-center">
            <span className="bg-success mr-2 rounded-xs px-2 py-1">{event.eventName}</span>
            <span className="shrink">{event?.data?.[0]?.toString()}</span>
            {event?.data?.length > 1 && (
              <span className="bg-info ml-2 rounded-md px-2 py-1">
                +{event.data.length - 1} {event.data.length - 1 > 1 ? 'Args' : 'Arg'}
              </span>
            )}
          </div>
        );
      }
      if (isMcpEvent(event)) {
        const eventMethod = event.method || METHOD_UNKNOWN;
        const isUnsupportedMethod = eventMethod.startsWith(unsupportedMethodPrefix);
        return (
          <div className="flex items-center gap-3">
            {isUnsupportedMethod && <span className="bg-warning mr-2 rounded-xs px-2 py-1">Unsupported</span>}
            <span className="shrink">{eventMethod.replace(`${unsupportedMethodPrefix}`, '')}</span>
            {isLoading && <Icon className="animate-spin" icon="spinner" />}
            {isLoading && event.direction === 'OUTGOING' && event.data?.id && (
              <Button
                aria-label="Cancel Request"
                className="flex aspect-square h-full items-center justify-center rounded-sm text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                onPress={() => {
                  window.main.mcp.client.cancelRequest({
                    requestId: event.requestId,
                    messageId: event.data.id.toString(),
                  });
                }}
              >
                <SvgIcon icon="prohibited" />
              </Button>
            )}
          </div>
        );
      }
      if ('data' in event && typeof event.data === 'object') {
        return 'Binary data';
      }
      return event.data.toString();
    }
    case 'notification': {
      if (isMcpEvent(event)) {
        const eventMethod = event.method || '';
        if (NOTIFICATIONS_LIST_CHANGED.includes(eventMethod)) {
          return (
            <span>
              {eventMethod}
              <HelpTooltip info className="space-left">
                {`${eventMethod.split('/')[1]} list has been changed. Use the left panel to get the latest list.`}
              </HelpTooltip>
            </span>
          );
        }
        return eventMethod;
      }
      return 'notification';
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

export const EventLogView: FC<Props> = ({
  events,
  onSelect,
  selectionId,
  autoSelectLatestEvent = false,
  protocol,
  readyState,
}) => {
  const parentRef = useRef<HTMLTableSectionElement>(null);
  const [pendingEvents, setPendingEvents] = useState<string[]>([]);

  const virtualizer = useVirtualizer({
    getScrollElement: () => parentRef.current,
    count: events.length,
    estimateSize: React.useCallback(() => 30, []),
    overscan: 30,
    getItemKey: index => events[index]._id,
  });

  useEffect(() => {
    // re-measure the virtualizer when EventLogView mounted, especially when switched in a tab
    virtualizer.measure();
  }, [virtualizer]);

  useEffect(() => {
    const updatePendingEvents = async (resId: string) => {
      const pendingEvents = await window.main.mcp.event.findPendingEvents({ requestId: resId });
      setPendingEvents(pendingEvents);
    };
    // For mcp protocol, fetch pending event ids from main process to show loading state
    if (protocol === 'mcp' && events.length > 0) {
      updatePendingEvents(events[0].requestId);
    }
  }, [events, protocol]);

  return (
    <>
      <div className="max-h-96 w-full flex-1 overflow-hidden overflow-x-auto overflow-y-auto border border-solid border-(--hl-sm) select-none">
        <Table
          selectionMode="single"
          selectedKeys={selectionId ? [selectionId] : []}
          selectionBehavior="replace"
          onSelectionChange={keys => {
            if (keys !== 'all') {
              const key = keys.values().next().value;

              const event = events.find(e => e._id === key);

              if (event) {
                onSelect(event);
              }
            }
          }}
          aria-label="Modified objects"
          className="w-full border-separate border-spacing-0"
        >
          <TableHeader className="sticky top-0 z-10 bg-(--hl-xs) backdrop-blur-sm backdrop-filter">
            <Column isRowHeader className="p-3 text-left text-xs font-semibold focus:outline-hidden">
              <span />
            </Column>
            <Column className="p-3 text-left text-xs font-semibold focus:outline-hidden">Data</Column>
            <Column className="p-3 text-left text-xs font-semibold focus:outline-hidden">Time</Column>
          </TableHeader>
          <TableBody
            style={{ height: virtualizer.getTotalSize() }}
            ref={parentRef}
            className="divide divide-solid divide-(--hl-sm)"
            items={virtualizer.getVirtualItems()}
          >
            {item => {
              const event = events[item.index];
              const isLoading = event.type === 'message' && !!readyState && pendingEvents.includes(event._id);
              const isSelectedRow = event._id === selectionId;
              // add focus style when autoSelectLatestEvent is true for the first row
              const rowExtraClasses =
                isSelectedRow && autoSelectLatestEvent
                  ? 'bg-(--hl-sm) outline-hidden'
                  : 'focus-within:bg-(--hl-sm) focus:outline-hidden';
              return (
                <Row className={`group transition-colors ${rowExtraClasses}`}>
                  <Cell className="border-b border-solid border-(--hl-sm) p-2 text-sm font-medium whitespace-nowrap group-last-of-type:border-none focus:outline-hidden">
                    <SvgIcon icon={getIcon(event)} />
                  </Cell>
                  <Cell className="border-b border-solid border-(--hl-sm) text-sm font-medium whitespace-nowrap group-last-of-type:border-none focus:outline-hidden">
                    {getMessage(event, isLoading)}
                  </Cell>
                  <Cell className="border-b border-solid border-(--hl-sm) text-sm font-medium whitespace-nowrap group-last-of-type:border-none focus:outline-hidden">
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
