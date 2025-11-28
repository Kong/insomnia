import classnames from 'classnames';
import React, { type FC, useEffect, useMemo, useState } from 'react';
import { Button, Input, SearchField, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { docsMcpAuthentication } from '~/common/documentation';
import { useMcpReadyState } from '~/ui/hooks/use-mcp-ready-state';
import { useRealtimeConnectionNotifications } from '~/ui/hooks/use-realtime-connection-notifications';

import { getSetCookieHeaders } from '../../../common/misc';
import type { McpEvent } from '../../../main/mcp/types';
import type { CurlEvent } from '../../../main/network/curl';
import type { ResponseTimelineEntry } from '../../../main/network/libcurl-promise';
import type { SocketIOEvent } from '../../../main/network/socket-io';
import type { WebSocketEvent } from '../../../main/network/websocket';
import { TRANSPORT_TYPES } from '../../../models/mcp-request';
import { isMcpResponse, type McpResponse } from '../../../models/mcp-response';
import type { RequestVersion } from '../../../models/request-version';
import type { Response } from '../../../models/response';
import { isSocketIOResponse, type SocketIOResponse } from '../../../models/socket-io-response';
import { type WebSocketResponse } from '../../../models/websocket-response';
import { useRequestLoaderData } from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { deserializeNDJSON } from '../../../utils/ndjson';
import { useReadyState } from '../../hooks/use-ready-state';
import { useRealtimeConnectionEvents } from '../../hooks/use-realtime-connection-events';
import { ResponseHistoryDropdown } from '../dropdowns/response-history-dropdown';
import { ErrorBoundary } from '../error-boundary';
import { Icon } from '../icon';
import { McpEventView } from '../mcp/event-view';
import { McpNotificationTab } from '../mcp/mcp-notification-tab';
import { Pane, PaneHeader } from '../panes/pane';
import { PlaceholderResponsePane } from '../panes/placeholder-response-pane';
import { SocketIOEventView } from '../socket-io/event-view';
import { SvgIcon } from '../svg-icon';
import { SizeTag } from '../tags/size-tag';
import { StatusTag } from '../tags/status-tag';
import { TimeTag } from '../tags/time-tag';
import { ResponseCookiesViewer } from '../viewers/response-cookies-viewer';
import { ResponseErrorViewer } from '../viewers/response-error-viewer';
import { ResponseHeadersViewer } from '../viewers/response-headers-viewer';
import { ResponseTimelineViewer } from '../viewers/response-timeline-viewer';
import { EventLogView } from './event-log-view';
import { EventView } from './event-view';

export const RealtimeResponsePane: FC<{ requestId?: string }> = () => {
  const { activeResponse, responses, requestVersions } = useRequestLoaderData()!;

  if (!activeResponse) {
    return (
      <Pane type="response">
        <PaneHeader className="justify-normal!" />
        <PlaceholderResponsePane />
      </Pane>
    );
  }
  return (
    <RealTimeActiveResponsePaneWrapper
      response={activeResponse}
      responses={responses}
      requestVersions={requestVersions}
      autoSelectLatestEvent={isMcpResponse(activeResponse)}
    />
  );
};

type ResponseType = WebSocketResponse | Response | SocketIOResponse | McpResponse;
type EventType = CurlEvent | WebSocketEvent | SocketIOEvent | McpEvent;
type ReadyState = 'disconnected' | 'connecting' | 'connected';
interface RealtimeActiveResponsePaneProps {
  response: ResponseType;
  responses: ResponseType[];
  requestVersions: RequestVersion[];
  autoSelectLatestEvent?: boolean;
}

const RealTimeActiveResponsePaneWrapper: FC<RealtimeActiveResponsePaneProps> = props => {
  const { response } = props;
  const protocol = useMemo(() => {
    if (isSocketIOResponse(response)) {
      return 'socketIO';
    }
    if (isMcpResponse(response)) {
      return 'mcp';
    }
    return response.type === 'WebSocketResponse' ? 'webSocket' : 'curl';
  }, [response]);

  if (protocol === 'mcp') {
    return <RealTimeActiveResponsePaneForMcp {...props} />;
  }
  return <RealTimeActiveResponsePaneForOthers {...props} protocol={protocol} />;
};

const RealTimeActiveResponsePaneForMcp: FC<RealtimeActiveResponsePaneProps> = props => {
  const { response } = props;
  const requestId = response.parentId;
  const readyState = useMcpReadyState({ requestId });
  return <RealtimeActiveResponsePane {...props} readyState={readyState} />;
};

const RealTimeActiveResponsePaneForOthers: FC<
  RealtimeActiveResponsePaneProps & { protocol: 'curl' | 'webSocket' | 'socketIO' }
> = props => {
  const { response, protocol } = props;
  const requestId = response.parentId;
  const readyState = useReadyState({ requestId, protocol });
  return <RealtimeActiveResponsePane {...props} readyState={readyState ? 'connected' : 'disconnected'} />;
};

const RealtimeActiveResponsePane: FC<RealtimeActiveResponsePaneProps & { readyState: ReadyState }> = ({
  response,
  responses,
  requestVersions,
  autoSelectLatestEvent,
  readyState,
}) => {
  const [selectedEvent, setSelectedEvent] = useState<EventType | null>(null);
  const [timeline, setTimeline] = useState<ResponseTimelineEntry[]>([]);
  const [clearEventsBefore, setClearEventsBefore] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [eventType, setEventType] = useState<CurlEvent['type']>();
  const isConnected = readyState === 'connected';

  const protocol = useMemo(() => {
    if (isSocketIOResponse(response)) {
      return 'socketIO';
    }
    if (isMcpResponse(response)) {
      return 'mcp';
    }
    return response.type === 'WebSocketResponse' ? 'webSocket' : 'curl';
  }, [response]);

  const allEvents = useRealtimeConnectionEvents({ responseId: response._id, protocol }) as EventType[];
  const allNotifications = useRealtimeConnectionNotifications({ responseId: response._id, protocol });
  const handleSelection = (event: EventType) => {
    setSelectedEvent((selected: EventType | null) => (selected?._id === event._id ? null : event));
  };
  const getEventView = (selectedEvent: EventType) => {
    if (isSocketIOResponse(response)) {
      return <SocketIOEventView event={selectedEvent as SocketIOEvent} key={selectedEvent._id} />;
    } else if (isMcpResponse(response)) {
      return <McpEventView event={selectedEvent as McpEvent} key={selectedEvent._id} />;
    }

    return <EventView event={selectedEvent as WebSocketEvent} key={selectedEvent._id} />;
  };

  const events = useMemo(
    () =>
      allEvents.filter(event => {
        // Filter out events that are earlier than the clearEventsBefore timestamp
        if (clearEventsBefore && event.timestamp <= clearEventsBefore) {
          return false;
        }

        // Filter out events that don't match the selected event type
        if (eventType && event.type !== eventType) {
          return false;
        }

        // Filter out events that don't match the search query
        if (searchQuery) {
          if (event.type === 'message') {
            if (protocol === 'mcp') {
              // MCP message event data can search both method and json stringified data
              const eventMethod = 'method' in event ? event.method : '';
              const eventData = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
              return (
                eventMethod.toLowerCase().includes(searchQuery.toLowerCase()) ||
                eventData.toLowerCase().includes(searchQuery.toLowerCase())
              );
            }
            return event.data.toString().toLowerCase().includes(searchQuery.toLowerCase());
          }
          if (event.type === 'error') {
            return event.message.toLowerCase().includes(searchQuery.toLowerCase());
          }
          if (event.type === 'close') {
            return event.reason.toLowerCase().includes(searchQuery.toLowerCase());
          }

          // Filter out open events
          return false;
        }

        return true;
      }),
    [allEvents, clearEventsBefore, eventType, protocol, searchQuery],
  );

  useEffect(() => {
    if (events.length > 0 && autoSelectLatestEvent) {
      setSelectedEvent(events[0]);
    }
  }, [events, autoSelectLatestEvent]);

  useEffect(() => {
    setSelectedEvent(null);
    setSearchQuery('');
    setClearEventsBefore(null);
  }, [response._id]);

  useEffect(() => {
    let isMounted = true;
    const fn = async () => {
      const content = await window.main.secureReadFile({
        path: response.timelinePath,
      });

      const timelineParsed = deserializeNDJSON(content);
      if (isMounted) {
        setTimeline(timelineParsed);
      }
    };
    fn();
    return () => {
      isMounted = false;
    };
  }, [response.timelinePath, events.length]);

  const isLongRunning = isSocketIOResponse(response) || isMcpResponse(response);
  const hideCookies = isSocketIOResponse(response) || isMcpResponse(response);
  const hideHeaders =
    isSocketIOResponse(response) || (isMcpResponse(response) && response.transportType === TRANSPORT_TYPES.STDIO);

  const cookieHeaders = hideCookies ? [] : getSetCookieHeaders(response.headers);

  // When it is an MCP auth error, show the docs link about MCP authentication and keep the events view to be visible for better context.
  const isMCPAuthError = isMcpResponse(response) && response.error && response.errorType === 'auth';

  return (
    <Pane type="response">
      <PaneHeader className="row-spaced">
        <div className="no-wrap scrollable scrollable--no-bars pad-left">
          {isLongRunning ? (
            <div
              data-testid="response-status-tag"
              className={classnames('px-2 py-1 capitalize', {
                'bg-success': readyState === 'connected',
                'bg-info': readyState === 'connecting',
                'bg-danger': readyState === 'disconnected',
              })}
            >
              {readyState}
            </div>
          ) : (
            <>
              <StatusTag statusCode={response.statusCode} statusMessage={response.statusMessage} />
              <TimeTag milliseconds={response.elapsedTime} steps={[]} />
              <SizeTag bytesRead={0} bytesContent={0} />
            </>
          )}
        </div>
        <ResponseHistoryDropdown activeResponse={response} requestVersions={requestVersions} responses={responses} />
      </PaneHeader>
      <Tabs aria-label="Request group tabs" className="flex h-full w-full flex-1 flex-col">
        <TabList
          className="flex h-(--line-height-sm) w-full shrink-0 items-center overflow-x-auto border-b border-solid border-b-(--hl-md) bg-(--color-bg)"
          aria-label="Request pane tabs"
        >
          <Tab
            className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
            id="events"
          >
            Events
          </Tab>
          {isMcpResponse(response) && (
            <Tab
              className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
              id="notifications"
            >
              Notifications
              {allNotifications.length > 0 && (
                <span className="flex aspect-square items-center justify-between overflow-hidden rounded-lg border border-solid border-(--hl-md) p-2 text-xs">
                  {allNotifications.length}
                </span>
              )}
            </Tab>
          )}
          {!hideHeaders && (
            <Tab
              className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
              id="headers"
            >
              Headers
              {response.headers.length > 0 && (
                <span className="flex aspect-square items-center justify-between overflow-hidden rounded-lg border border-solid border-(--hl-md) p-2 text-xs">
                  {response.headers.length}
                </span>
              )}
            </Tab>
          )}
          {!hideCookies && (
            <Tab
              className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
              id="cookies"
            >
              Cookies
              {cookieHeaders.length > 0 && (
                <span className="flex aspect-square items-center justify-between overflow-hidden rounded-lg border border-solid border-(--hl-md) p-2 text-xs">
                  {cookieHeaders.length}
                </span>
              )}
            </Tab>
          )}
          <Tab
            className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
            id="timeline"
          >
            Console
          </Tab>
        </TabList>
        <TabPanel className="flex w-full flex-1 flex-col overflow-hidden" id="events">
          <PanelGroup direction="vertical" className="grid h-full w-full grid-rows-[repeat(auto-fit,minmax(0,1fr))]">
            {response.error && !isMCPAuthError ? (
              <ResponseErrorViewer url={response.url} error={response.error} />
            ) : (
              <>
                <Panel minSize={10} defaultSize={50} className="box-border flex w-full flex-1 flex-col overflow-hidden">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: 'var(--padding-sm)',
                      gap: 'var(--padding-sm)',
                    }}
                  >
                    <select
                      disabled={protocol === 'curl'}
                      onChange={e => setEventType(e.currentTarget.value as CurlEvent['type'])}
                    >
                      <option value="">All</option>
                      <option value="message">Message</option>
                      <option value="open">Open</option>
                      <option value="close">Close</option>
                      <option value="error">Error</option>
                    </select>

                    <SearchField
                      aria-label="Events filter"
                      className="group relative w-full flex-1"
                      defaultValue={searchQuery}
                      onChange={query => {
                        setSearchQuery(query);
                      }}
                    >
                      <Input
                        placeholder="Search"
                        className="w-full rounded-sm border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
                      />
                      <div className="absolute top-0 right-0 flex h-full items-center px-2">
                        <Button className="flex aspect-square w-5 items-center justify-center rounded-sm text-sm text-(--color-font) ring-1 ring-transparent transition-all group-data-empty:hidden hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)">
                          <Icon icon="close" />
                        </Button>
                      </div>
                    </SearchField>
                    <Button
                      aria-label="Create in collection"
                      className="flex aspect-square h-full items-center justify-center rounded-sm text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                      onPress={() => {
                        const lastEvent = events[0];
                        setClearEventsBefore(lastEvent.timestamp);
                      }}
                    >
                      <SvgIcon icon="prohibited" />
                    </Button>
                  </div>

                  {Boolean(events?.length) && (
                    <EventLogView
                      events={events}
                      onSelect={handleSelection}
                      selectionId={selectedEvent?._id}
                      autoSelectLatestEvent
                      protocol={protocol}
                      readyState={isConnected}
                    />
                  )}
                </Panel>
                {isMCPAuthError ? (
                  <ResponseErrorViewer url={response.url} error={response.error} docsLink={docsMcpAuthentication} />
                ) : null}
                {selectedEvent && (
                  <>
                    <PanelResizeHandle className={'h-px w-full bg-(--hl-md)'} />
                    <Panel minSize={10} defaultSize={isMcpResponse(response) ? 85 : 60}>
                      <div className="h-full flex-1">{getEventView(selectedEvent)}</div>
                    </Panel>
                  </>
                )}
              </>
            )}
          </PanelGroup>
        </TabPanel>
        {isMcpResponse(response) && (
          <TabPanel className="flex w-full flex-1 flex-col overflow-hidden" id="notifications">
            <McpNotificationTab allEvents={allNotifications} />
          </TabPanel>
        )}
        {!isSocketIOResponse(response) && (
          <>
            <TabPanel className="flex w-full flex-1 flex-col overflow-y-auto" id="headers">
              <ErrorBoundary key={response._id} errorClassName="font-error pad text-center">
                <ResponseHeadersViewer headers={response.headers} />
              </ErrorBoundary>
            </TabPanel>
            <TabPanel className="flex w-full flex-1 flex-col overflow-y-auto" id="cookies">
              <ErrorBoundary key={response._id} errorClassName="font-error pad text-center">
                <ResponseCookiesViewer
                  cookiesSent={response.settingSendCookies}
                  cookiesStored={response.settingStoreCookies}
                  headers={cookieHeaders}
                />
              </ErrorBoundary>
            </TabPanel>
          </>
        )}
        <TabPanel className="flex w-full flex-1 flex-col overflow-hidden" id="timeline">
          <ResponseTimelineViewer key={response._id} timeline={timeline} pinToBottom={true} />
        </TabPanel>
      </Tabs>
    </Pane>
  );
};
