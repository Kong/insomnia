import fs from 'node:fs';

import React, { type FC, useEffect, useState } from 'react';
import { Button, Input, SearchField, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useRouteLoaderData } from 'react-router';

import type { ResponseTimelineEntry } from '../../../main/network/libcurl-promise';
import type { SocketIOEvent } from '../../../main/network/socket-io';
import type { SocketIOResponse } from '../../../models/socket-io-response';
import { deserializeNDJSON } from '../../../utils/ndjson';
import { useReadyState } from '../../hooks/use-ready-state';
import { useRealtimeConnectionEvents } from '../../hooks/use-realtime-connection-events';
import type { SocketIORequestLoaderData } from '../../routes/request';
import { ResponseHistoryDropdown } from '../dropdowns/response-history-dropdown';
import { Icon } from '../icon';
import { Pane, PaneHeader } from '../panes/pane';
import { PlaceholderResponsePane } from '../panes/placeholder-response-pane';
import { SvgIcon } from '../svg-icon';
import { ResponseErrorViewer } from '../viewers/response-error-viewer';
import { ResponseTimelineViewer } from '../viewers/response-timeline-viewer';
import { EventLogView } from './event-log-view';
import { SocketIOEventView } from './event-view';

export const SocketIOResponsePane: FC<{ requestId: string }> = ({ requestId }) => {
  const { activeResponse } = useRouteLoaderData('request/:requestId') as SocketIORequestLoaderData;

  if (!activeResponse) {
    return (
      <Pane type="response">
        <PaneHeader className="!justify-normal" />
        <PlaceholderResponsePane />
      </Pane>
    );
  }
  return <SocketIOActiveResponsePane response={activeResponse} requestId={requestId} />;
};

const SocketIOActiveResponsePane: FC<{ response: SocketIOResponse; requestId: string }> = ({ response, requestId }) => {
  const [selectedEvent, setSelectedEvent] = useState<SocketIOEvent | null>(null);
  const [timeline, setTimeline] = useState<ResponseTimelineEntry[]>([]);
  const [clearEventsBefore, setClearEventsBefore] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [eventType, setEventType] = useState<SocketIOEvent['type']>();
  const protocol = 'socketIO';
  const allEvents = useRealtimeConnectionEvents({ responseId: response._id, protocol }) as SocketIOEvent[];
  const readyState = useReadyState({ requestId: requestId, protocol: 'socketIO' });
  const connected = readyState ? response?.connected : false;

  const handleSelection = (event: SocketIOEvent) => {
    setSelectedEvent((selected: SocketIOEvent | null) => (selected?._id === event._id ? null : event));
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

  return (
    <Pane type="response">
      <PaneHeader className="row-spaced">
        <div className="no-wrap scrollable scrollable--no-bars pad-left">
          <div className={`${connected ? 'bg-success' : 'bg-danger'} px-2 py-1`}>
            {connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        <ResponseHistoryDropdown activeResponse={response} />
      </PaneHeader>
      <Tabs aria-label="Request group tabs" className="flex h-full w-full flex-1 flex-col">
        <TabList
          className="scro flex h-[--line-height-sm] w-full flex-shrink-0 items-center overflow-x-auto border-b border-solid border-b-[--hl-md] bg-[--color-bg]"
          aria-label="Request pane tabs"
        >
          <Tab
            className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
            id="events"
          >
            Events
          </Tab>
          <Tab
            className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
            id="timeline"
          >
            Console
          </Tab>
        </TabList>
        <TabPanel className="flex w-full flex-1 flex-col overflow-hidden" id="events">
          <PanelGroup direction="vertical" className="grid h-full w-full grid-rows-[repeat(auto-fit,minmax(0,1fr))]">
            {response.error ? (
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
                    <select onChange={e => setEventType(e.currentTarget.value as SocketIOEvent['type'])}>
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
                        className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
                      />
                      <div className="absolute right-0 top-0 flex h-full items-center px-2">
                        <Button className="flex aspect-square w-5 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm] group-data-[empty]:hidden">
                          <Icon icon="close" />
                        </Button>
                      </div>
                    </SearchField>
                    <Button
                      aria-label="Create in collection"
                      className="flex aspect-square h-full items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                      onPress={() => {
                        const lastEvent = events[0];
                        setClearEventsBefore(lastEvent.timestamp);
                      }}
                    >
                      <SvgIcon icon="prohibited" />
                    </Button>
                  </div>

                  {Boolean(events?.length) && (
                    <EventLogView events={events} onSelect={handleSelection} selectionId={selectedEvent?._id} />
                  )}
                </Panel>
                {selectedEvent && (
                  <>
                    <PanelResizeHandle className={'h-[1px] w-full bg-[--hl-md]'} />
                    <Panel minSize={10} defaultSize={50}>
                      <div className="h-full flex-1 border-t border-[var(--hl-md)]">
                        <SocketIOEventView key={selectedEvent._id} event={selectedEvent} />
                      </div>
                    </Panel>
                  </>
                )}
              </>
            )}
          </PanelGroup>
        </TabPanel>
        <TabPanel className="flex w-full flex-1 flex-col overflow-hidden" id="timeline">
          <ResponseTimelineViewer key={response._id} timeline={timeline} pinToBottom={true} />
        </TabPanel>
      </Tabs>
    </Pane>
  );
};
