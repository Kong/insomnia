import fs from 'fs';
import React, { type FC, useEffect, useState } from 'react';
import { Button, Input, SearchField, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useRouteLoaderData } from 'react-router-dom';

import { getSetCookieHeaders } from '../../../common/misc';
import type { CurlEvent } from '../../../main/network/curl';
import type { ResponseTimelineEntry } from '../../../main/network/libcurl-promise';
import type { WebSocketEvent } from '../../../main/network/websocket';
import type { Response } from '../../../models/response';
import type { WebSocketResponse } from '../../../models/websocket-response';
import { deserializeNDJSON } from '../../../utils/ndjson';
import { useRealtimeConnectionEvents } from '../../hooks/use-realtime-connection-events';
import type { RequestLoaderData, WebSocketRequestLoaderData } from '../../routes/request';
import { ResponseHistoryDropdown } from '../dropdowns/response-history-dropdown';
import { ErrorBoundary } from '../error-boundary';
import { Icon } from '../icon';
import { Pane, PaneHeader } from '../panes/pane';
import { PlaceholderResponsePane } from '../panes/placeholder-response-pane';
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

export const RealtimeResponsePane: FC<{ requestId: string }> = () => {
  const { activeResponse } = useRouteLoaderData('request/:requestId') as RequestLoaderData | WebSocketRequestLoaderData;

  if (!activeResponse) {
    return (
      <Pane type="response">
        <PaneHeader className='!justify-normal' />
        <PlaceholderResponsePane />
      </Pane>
    );
  }
  return <RealtimeActiveResponsePane response={activeResponse} />;
};

const RealtimeActiveResponsePane: FC<{ response: WebSocketResponse | Response }> = ({
  response,
}) => {
  const [selectedEvent, setSelectedEvent] = useState<CurlEvent | WebSocketEvent | null>(null);
  const [timeline, setTimeline] = useState<ResponseTimelineEntry[]>([]);
  const [clearEventsBefore, setClearEventsBefore] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [eventType, setEventType] = useState<CurlEvent['type']>();
  const protocol = response.type === 'WebSocketResponse' ? 'webSocket' : 'curl';
  const allEvents = useRealtimeConnectionEvents({ responseId: response._id, protocol });
  const handleSelection = (event: CurlEvent | WebSocketEvent) => {
    setSelectedEvent((selected: CurlEvent | WebSocketEvent | null) => selected?._id === event._id ? null : event);
  };

  const events = allEvents.filter(event => {
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
  });

  useEffect(() => {
    setSelectedEvent(null);
    setSearchQuery('');
    setClearEventsBefore(null);
  }, [response._id]);

  useEffect(() => {
    let isMounted = true;
    const fn = async () => {
      try {
        await fs.promises.stat(response.timelinePath);
      } catch (err) {
        if (err.code === 'ENOENT') {
          return setTimeline([]);
        }
      }

      const rawBuffer = await fs.promises.readFile(response.timelinePath);
      const timelineString = rawBuffer.toString();
      const timelineParsed = deserializeNDJSON(timelineString);
      if (isMounted) {
        setTimeline(timelineParsed);
      }
    };
    fn();
    return () => {
      isMounted = false;
    };
  }, [response.timelinePath, events.length]);

  const cookieHeaders = getSetCookieHeaders(response.headers);
  return (
    <Pane type="response">
      <PaneHeader className="row-spaced">
        <div className="no-wrap scrollable scrollable--no-bars pad-left">
          <StatusTag statusCode={response.statusCode} statusMessage={response.statusMessage} />
          <TimeTag milliseconds={response.elapsedTime} steps={[]} />
          <SizeTag bytesRead={0} bytesContent={0} />
        </div>
        <ResponseHistoryDropdown
          activeResponse={response}
        />
      </PaneHeader>
      <Tabs aria-label='Request group tabs' className="flex-1 w-full h-full flex flex-col">
        <TabList className='w-full flex-shrink-0  overflow-x-auto border-solid scro border-b border-b-[--hl-md] bg-[--color-bg] flex items-center h-[--line-height-sm]' aria-label='Request pane tabs'>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='events'
          >
            Events
          </Tab>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='headers'
          >
            Headers
            {response.headers.length > 0 && (
              <span className="p-2 aspect-square flex items-center justify-between border-solid border border-[--hl-md] overflow-hidden rounded-lg text-xs shadow-small">{response.headers.length}</span>
            )}
          </Tab>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='cookies'
          >
            Cookies
            {cookieHeaders.length > 0 && (
              <span className="p-2 aspect-square flex items-center justify-between border-solid border border-[--hl-md] overflow-hidden rounded-lg text-xs shadow-small">{cookieHeaders.length}</span>
            )}
          </Tab>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='timeline'
          >
            Console
          </Tab>
        </TabList>
        <TabPanel className='w-full flex-1 flex flex-col overflow-hidden' id='events'>
          <PanelGroup direction='vertical' className='h-full w-full grid grid-rows-[repeat(auto-fit,minmax(0,1fr))]'>
            {response.error ? <ResponseErrorViewer url={response.url} error={response.error} />
              : <>
                <Panel minSize={10} defaultSize={50} className="w-full flex flex-col overflow-hidden box-border flex-1">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: 'var(--padding-sm)',
                      gap: 'var(--padding-sm)',
                    }}
                  >
                    <select disabled={protocol === 'curl'} onChange={e => setEventType(e.currentTarget.value as CurlEvent['type'])}>
                      <option value="">All</option>
                      <option value="message">Message</option>
                      <option value="open">Open</option>
                      <option value="close">Close</option>
                      <option value="error">Error</option>
                    </select>

                    <SearchField
                      aria-label="Events filter"
                      className="group relative flex-1 w-full"
                      defaultValue={searchQuery}
                      onChange={query => {
                        setSearchQuery(query);
                      }}
                    >
                      <Input
                        placeholder="Search"
                        className="py-1 w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                      />
                      <div className="flex items-center px-2 absolute right-0 top-0 h-full">
                        <Button className="flex group-data-[empty]:hidden items-center justify-center aspect-square w-5 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                          <Icon icon="close" />
                        </Button>
                      </div>
                    </SearchField>
                    <Button
                      aria-label="Create in collection"
                      className="flex items-center justify-center h-full aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                      onPress={() => {
                        const lastEvent = events[0];
                        setClearEventsBefore(lastEvent.timestamp);
                      }}
                    >
                      <SvgIcon icon='prohibited' />
                    </Button>
                  </div>

                  {Boolean(events?.length) && (
                    <EventLogView
                      events={events}
                      onSelect={handleSelection}
                      selectionId={selectedEvent?._id}
                    />
                  )}
                </Panel>
                {selectedEvent && (
                  <>
                    <PanelResizeHandle className={'w-full h-[1px] bg-[--hl-md]'} />
                    <Panel minSize={10} defaultSize={50}>
                      <div className="flex-1 border-t border-[var(--hl-md)] h-full">
                        <EventView
                          key={selectedEvent._id}
                          event={selectedEvent}
                        />
                      </div>
                    </Panel>
                  </>
                )}
              </>}
          </PanelGroup>
        </TabPanel>
        <TabPanel className='w-full flex-1 flex flex-col overflow-y-auto' id='headers'>
          <ErrorBoundary key={response._id} errorClassName="font-error pad text-center">
            <ResponseHeadersViewer headers={response.headers} />
          </ErrorBoundary>
        </TabPanel>
        <TabPanel className='w-full flex-1 flex flex-col overflow-y-auto' id='cookies'>
          <ErrorBoundary key={response._id} errorClassName="font-error pad text-center">
            <ResponseCookiesViewer
              cookiesSent={response.settingSendCookies}
              cookiesStored={response.settingStoreCookies}
              headers={cookieHeaders}
            />
          </ErrorBoundary>
        </TabPanel>
        <TabPanel className='w-full flex-1 flex flex-col overflow-hidden' id='timeline'>
          <ResponseTimelineViewer
            key={response._id}
            timeline={timeline}
            pinToBottom={true}
          />
        </TabPanel>
      </Tabs>
    </ Pane>
  );
};
