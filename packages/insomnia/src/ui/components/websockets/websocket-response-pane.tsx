import fs from 'fs';
import React, { FC, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import styled from 'styled-components';

import { getSetCookieHeaders } from '../../../common/misc';
import { ResponseTimelineEntry } from '../../../main/network/libcurl-promise';
import { WebSocketEvent } from '../../../main/network/websocket';
import { WebSocketResponse } from '../../../models/websocket-response';
import { useWebSocketConnectionEvents } from '../../context/websocket-client/use-ws-connection-events';
import { selectActiveResponse } from '../../redux/selectors';
import { ResponseHistoryDropdown } from '../dropdowns/response-history-dropdown';
import { ErrorBoundary } from '../error-boundary';
import { EmptyStatePane } from '../panes/empty-state-pane';
import { Pane, PaneHeader as OriginalPaneHeader } from '../panes/pane';
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

export const WebSocketResponsePane: FC<{ requestId: string }> =
  ({
    requestId,
  }) => {
    const response = useSelector(selectActiveResponse) as WebSocketResponse | null;
    if (!response) {
      return (
        <Pane type="response">
          <PaneHeader />
          <EmptyStatePane
            icon={<i className="fa fa-paper-plane" />}
            documentationLinks={[
              {
                title: 'Introduction to WebSockets in Insomnia',
                url: 'https://docs.insomnia.rest/insomnia/requests',
              },
            ]}
            title="Enter a URL and connect to a WebSocket server to start sending data"
            secondaryAction="Select a payload type to send data to the connection"
          />
        </Pane>
      );
    }
    return <WebSocketActiveResponsePane requestId={requestId} response={response} />;
  };

const WebSocketActiveResponsePane: FC<{ requestId: string; response: WebSocketResponse }> = ({
  requestId,
  response,
}) => {
  const [selectedEvent, setSelectedEvent] = useState<WebSocketEvent | null>(null);
  const [timeline, setTimeline] = useState<ResponseTimelineEntry[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [clearEventsBefore, setClearEventsBefore] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [eventType, setEventType] = useState<WebSocketEvent['type']>();
  const allEvents = useWebSocketConnectionEvents({ responseId: response._id });
  const handleSelection = (event: WebSocketEvent) => {
    setSelectedEvent((selected: WebSocketEvent | null) => selected?._id === event._id ? null : event);
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
      // @TODO: this needs to fs.watch or tail the file, instead of reading the whole thing on every event.
      // or alternatively a throttle to keep it from reading too frequently
      const rawBuffer = await fs.promises.readFile(response.timelinePath);
      const timelineString = rawBuffer.toString();
      const timelineParsed = timelineString.split('\n').filter(e => e?.trim()).map(e => JSON.parse(e));
      isMounted && setTimeline(timelineParsed);
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
          requestId={requestId}
          className="tall pane__header__right"
        />
      </PaneHeader>
      <Tabs className="pane__body theme--pane__body react-tabs">
        <TabList>
          <Tab tabIndex="-1" >
            <button>Events</button>
          </Tab>
          <Tab tabIndex="-1">
            <button>
              Headers{' '}
              {response?.headers.length > 0 && (
                <span className="bubble">{response.headers.length}</span>
              )}
            </button>
          </Tab>
          <Tab tabIndex="-1">
            <button>
              Cookies{' '}
              {cookieHeaders.length ? (
                <span className="bubble">{cookieHeaders.length}</span>
              ) : null}
            </button>
          </Tab>
          <Tab tabIndex="-1" >
            <button>Timeline</button>
          </Tab>
        </TabList>
        <TabPanel className="react-tabs__tab-panel">
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
                    <select onChange={e => setEventType(e.currentTarget.value as WebSocketEvent['type'])}>
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
                      requestId={requestId}
                      event={selectedEvent}
                    />
                  </EventViewWrapper>
                )}
              </>}
          </PaneBodyContent>
        </TabPanel>
        <TabPanel className="react-tabs__tab-panel scrollable-container">
          <div className="scrollable pad">
            <ErrorBoundary key={response._id} errorClassName="font-error pad text-center">
              <ResponseHeadersViewer headers={response.headers} />
            </ErrorBoundary>
          </div>
        </TabPanel>
        <TabPanel className="react-tabs__tab-panel scrollable-container">
          <div className="scrollable pad">
            <ErrorBoundary key={response._id} errorClassName="font-error pad text-center">
              <ResponseCookiesViewer
                cookiesSent={response.settingSendCookies}
                cookiesStored={response.settingStoreCookies}
                headers={cookieHeaders}
              />
            </ErrorBoundary>
          </div>
        </TabPanel>
        <TabPanel className="react-tabs__tab-panel">
          <ResponseTimelineViewer
            key={response._id}
            timeline={timeline}
          />
        </TabPanel>
      </Tabs>
    </ Pane>
  );
};
