import type { CancelledNotification } from '@modelcontextprotocol/sdk/types.js';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import React, { type FC, useEffect, useRef } from 'react';
import { Cell, Column, Row, Table, TableBody, TableHeader } from 'react-aria-components';

import { HelpTooltip } from '~/ui/components/help-tooltip';
import { Icon } from '~/ui/components/icon';

import {
  METHOD_NOTIFICATION_CANCELLED,
  METHOD_UNKNOWN,
  NOTIFICATIONS_LIST_CHANGED,
  unsupportedMethodPrefix,
} from '../../../common/mcp-utils';
import type { McpEvent, McpMessageEvent } from '../../../main/mcp/types';
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
            <span className="bg-success mr-2 rounded-sm px-2 py-1">{event.eventName}</span>
            <span className="flex-shrink">{event?.data?.[0]?.toString()}</span>
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
          <div className="flex items-center">
            {isLoading && <Icon className="mr-2 animate-spin" icon="spinner" />}
            {isUnsupportedMethod && <span className="bg-warning mr-2 rounded-sm px-2 py-1">Unsupported</span>}
            <span className="flex-shrink">{eventMethod.replace(`${unsupportedMethodPrefix}`, '')}</span>
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

  const virtualizer = useVirtualizer({
    getScrollElement: () => parentRef.current,
    count: events.length,
    estimateSize: React.useCallback(() => 30, []),
    overscan: 30,
    getItemKey: index => events[index]._id,
  });
  const isMcpEvents = protocol === 'mcp';

  useEffect(() => {
    // re-measure the virtualizer when EventLogView mounted, especially when switched in a tab
    virtualizer.measure();
  }, [virtualizer]);

  return (
    <>
      <div className="max-h-96 w-full flex-1 select-none overflow-hidden overflow-y-auto border border-solid border-[--hl-sm]">
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
          <TableHeader className="sticky top-0 z-10 bg-[--hl-xs] backdrop-blur backdrop-filter">
            <Column isRowHeader className="p-3 text-left text-xs font-semibold focus:outline-none">
              <span />
            </Column>
            <Column className="p-3 text-left text-xs font-semibold focus:outline-none">Data</Column>
            <Column className="p-3 text-left text-xs font-semibold focus:outline-none">Time</Column>
          </TableHeader>
          <TableBody
            style={{ height: virtualizer.getTotalSize() }}
            ref={parentRef}
            className="divide divide-solid divide-[--hl-sm]"
            items={virtualizer.getVirtualItems()}
          >
            {item => {
              let isLoading = false;
              const event = events[item.index];
              const isSelectedRow = event._id === selectionId;
              // add focus style when autoSelectLatestEvent is true for the first row
              const rowExtraClasses =
                isSelectedRow && autoSelectLatestEvent
                  ? 'bg-[--hl-sm] outline-none'
                  : 'focus-within:bg-[--hl-sm] focus:outline-none';
              if (isMcpEvents && event.type === 'message' && readyState) {
                // Adding loading indicator if the message has not been responded by the server from json-rpc id
                const { direction, data } = event;
                const jsonRPCId = 'id' in data && data.id;
                const method = (event as McpMessageEvent).method;
                const isUnsupportedMethod = method.startsWith(unsupportedMethodPrefix);
                const isErrorRequest = event.data.error;
                if (jsonRPCId && !isUnsupportedMethod && !isErrorRequest) {
                  isLoading = !events.find(e => {
                    if (e.type === 'message') {
                      const eventMethod = (e as McpMessageEvent).method;
                      if (eventMethod === METHOD_NOTIFICATION_CANCELLED) {
                        const eventData = e.data as CancelledNotification;
                        // find the cancelled notification message indicates cancellation of the request
                        return e.direction === direction && eventData.params.requestId === jsonRPCId;
                      }
                      // find the response message from server with the same json-rpc id but different direction
                      return (
                        eventMethod === method && e.direction !== direction && 'id' in e.data && e.data.id === jsonRPCId
                      );
                    } else if (e.type === 'error' && e.error && direction === 'OUTGOING') {
                      // find the error message with the same json-rpc id for all outgoing requests
                      return e.error?.requestId === jsonRPCId;
                    }
                    return false;
                  });
                }
              }
              return (
                <Row className={`group transition-colors ${rowExtraClasses}`}>
                  <Cell className="whitespace-nowrap border-b border-solid border-[--hl-sm] p-2 text-sm font-medium focus:outline-none group-last-of-type:border-none">
                    <SvgIcon icon={getIcon(event)} />
                  </Cell>
                  <Cell className="whitespace-nowrap border-b border-solid border-[--hl-sm] text-sm font-medium focus:outline-none group-last-of-type:border-none">
                    {getMessage(event, isLoading)}
                  </Cell>
                  <Cell className="whitespace-nowrap border-b border-solid border-[--hl-sm] text-sm font-medium focus:outline-none group-last-of-type:border-none">
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
