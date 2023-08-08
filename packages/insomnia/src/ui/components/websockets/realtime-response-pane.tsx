import fs from 'fs';
import React, { FC, useEffect, useRef, useState } from 'react';
import { useRouteLoaderData } from 'react-router-dom';
import styled from 'styled-components';

import { getSetCookieHeaders } from '../../../common/misc';
import { CurlEvent } from '../../../main/network/curl';
import { ResponseTimelineEntry } from '../../../main/network/libcurl-promise';
import { WebSocketEvent } from '../../../main/network/websocket';
import { Response } from '../../../models/response';
import { WebSocketResponse } from '../../../models/websocket-response';
import { useRealtimeConnectionEvents } from '../../hooks/use-realtime-connection-events';
import { RequestLoaderData, WebSocketRequestLoaderData } from '../../routes/request';
import { PanelContainer, TabItem, Tabs } from '../base/tabs';
import { ResponseHistoryDropdown } from '../dropdowns/response-history-dropdown';
import { ErrorBoundary } from '../error-boundary';
import { Pane, PaneHeader as OriginalPaneHeader } from '../panes/pane';
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

const PaneHeader = styled(OriginalPaneHeader)({
  '&&': { justifyContent: 'unset' },
});

const EventLogTableWrapper = styled.div({
  width: '100%',
  flex: 1,
  overflow: 'hidden',
  boxSizing: 'border-box',
});

const EventViewWrapper = styled.div({
  flex: 1,
  borderTop: '1px solid var(--hl-md)',
  height: '100%',
});

const PaneBodyContent = styled.div({
  height: '100%',
  width: '100%',
  display: 'grid',
  gridTemplateRows: 'repeat(auto-fit, minmax(0, 1fr))',
});

const EventSearchFormControl = styled.div({
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  position: 'relative',
  display: 'flex',
  border: '1px solid var(--hl-md)',
  borderRadius: 'var(--radius-md)',
});

const EventSearchInput = styled.input({
  paddingRight: '2em',
  padding: 'var(--padding-sm)',
  backgroundColor: 'var(--hl-xxs)',
  width: '100%',
  display: 'block',
  boxSizing: 'border-box',

  // Remove the default search input cancel button
  '::-webkit-search-cancel-button': {
    display: 'none',
  },

  ':focus': {
    backgroundColor: 'transparent',
    borderColor: 'var(--hl-lg)',
  },
});

const PaddedButton = styled('button')({
  padding: 'var(--padding-sm)',
});

export const RealtimeResponsePane: FC<{ requestId: string }> = () => {
  const { activeResponse } = useRouteLoaderData('request/:requestId') as RequestLoaderData | WebSocketRequestLoaderData;

  if (!activeResponse) {
    return (
      <Pane type="response">
        <PaneHeader />
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
  const searchInputRef = useRef<HTMLInputElement>(null);
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
      const rawBuffer = await fs.promises.readFile(response.timelinePath);
      const timelineString = rawBuffer.toString();
      const timelineParsed = timelineString.split('\n').filter(e => e?.trim()).map(e => JSON.parse(e));
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
          <TimeTag milliseconds={response.elapsedTime} />
          <SizeTag bytesRead={0} bytesContent={0} />
        </div>
        <ResponseHistoryDropdown
          activeResponse={response}
        />
      </PaneHeader>
      <Tabs aria-label="Curl response pane tabs">
        <TabItem key="events" title="Events">
          <PaneBodyContent>
            {response.error ? <ResponseErrorViewer url={response.url} error={response.error} />
              : <>
                <EventLogTableWrapper>
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

                    <EventSearchFormControl>
                      <EventSearchInput
                        ref={searchInputRef}
                        type="search"
                        placeholder="Search"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.currentTarget.value)}
                      />
                      {searchQuery && (
                        <PaddedButton
                          className="form-control__right"
                          onClick={() => {
                            setSearchQuery('');
                            searchInputRef.current?.focus();
                          }}
                        >
                          <i className="fa fa-times-circle" />
                        </PaddedButton>
                      )}
                    </EventSearchFormControl>
                    <PaddedButton
                      onClick={() => {
                        const lastEvent = events[0];
                        setClearEventsBefore(lastEvent.timestamp);
                      }}
                    >
                      <SvgIcon icon='prohibited' />
                    </PaddedButton>
                  </div>
                  {Boolean(events?.length) && (
                    <EventLogView
                      events={events}
                      onSelect={handleSelection}
                      selectionId={selectedEvent?._id}
                    />
                  )}
                </EventLogTableWrapper>
                {selectedEvent && (
                  <EventViewWrapper>
                    <EventView
                      key={selectedEvent._id}
                      event={selectedEvent}
                    />
                  </EventViewWrapper>
                )}
              </>}
          </PaneBodyContent>
        </TabItem>
        <TabItem
          key="headers"
          title={
            <>
              Headers{' '}
              {response?.headers.length > 0 && (
                <span className="bubble">{response.headers.length}</span>
              )}
            </>
          }
        >
          <PanelContainer className="pad">
            <ErrorBoundary key={response._id} errorClassName="font-error pad text-center">
              <ResponseHeadersViewer headers={response.headers} />
            </ErrorBoundary>
          </PanelContainer>
        </TabItem>
        <TabItem
          key="cookies"
          title={
            <>
              Cookies{' '}
              {cookieHeaders.length ? (
                <span className="bubble">{cookieHeaders.length}</span>
              ) : null}
            </>
          }
        >
          <PanelContainer className="pad">
            <ErrorBoundary key={response._id} errorClassName="font-error pad text-center">
              <ResponseCookiesViewer
                cookiesSent={response.settingSendCookies}
                cookiesStored={response.settingStoreCookies}
                headers={cookieHeaders}
              />
            </ErrorBoundary>
          </PanelContainer>
        </TabItem>
        <TabItem key="timeline" title="Timeline">
          <ResponseTimelineViewer
            key={response._id}
            timeline={timeline}
            pinToBottom={true}
          />
        </TabItem>
      </Tabs>
    </ Pane>
  );
};
