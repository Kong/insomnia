import React, { FC, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import styled from 'styled-components';

import { ResponseTimelineEntry } from '../../../main/network/libcurl-promise';
import { WebsocketEvent } from '../../../main/network/websocket';
import type { Response } from '../../../models/response';
import { createWebSocketClient } from '../../context/websocket-client/create-websocket-client';
import { useWebSocketConnectionEvents } from '../../context/websocket-client/use-ws-connection-events';
import { WebSocketClientProvider } from '../../context/websocket-client/websocket-client-context';
import {  selectActiveResponse } from '../../redux/selectors';
import { ResponseHistoryDropdown } from '../dropdowns/response-history-dropdown';
import { Pane, PaneHeader as OriginalPaneHeader } from '../panes/pane';
import { SizeTag } from '../tags/size-tag';
import { StatusTag } from '../tags/status-tag';
import { TimeTag } from '../tags/time-tag';
import { ResponseTimelineViewer } from '../viewers/response-timeline-viewer';
import { EventLogTable } from './event-log-table';
import { EventLogView } from './event-log-view';

const PaneHeader = styled(OriginalPaneHeader)({
  '&&': { justifyContent: 'unset' },
});
const EventLogTableWrapper = styled.div({
  width: '100%',
  flex: 1,
  overflowY: 'scroll',
  padding: 'var(--padding-sm)',
  boxSizing: 'border-box',
});
const EventLogViewWrapper = styled.div({
  flex: 1,
  borderTop: '1px solid var(--hl-md)',
  height: '100%',
  boxSizing: 'content-box',
  padding: 'var(--padding-sm)',
});
const fakeResponse: { _id: string } = {
  _id: 'test',
};
export const ResponsePane: FC<{ requestId: string; handleSetActiveResponse: (requestId: string, activeResponse: Response | null) => void }> = ({
  requestId,
  handleSetActiveResponse,
}) => {
  const [selectedEvent, setSelectedEvent] = useState<WebsocketEvent | null>(
    null
  );
  const events = useWebSocketConnectionEvents({ requestId });
  const handleSelection = (event: WebsocketEvent) => {
    setSelectedEvent((selected: WebsocketEvent | null) => selected?._id === event._id ? null : event);
  };
  // @TODO: drill this?
  const response = useSelector(selectActiveResponse);

  useEffect(() => {
    setSelectedEvent(null);
  }, []);
  const timeline: ResponseTimelineEntry[] = [];
  // if (response) {
  //   timeline.push({ value: 'Preparing request to ws://example.com/chat', name: 'Text', timestamp: Date.now() });
  //   timeline.push({ value: `Current time is ${new Date().toISOString()}`, name: 'Text', timestamp: Date.now() });
  //   timeline.push({ value: 'Using HTTP 1.1', name: 'Text', timestamp: Date.now() });
  //   timeline.push({ value: 'UPGRADE /chat HTTP/1.1\r\nHost: 127.0.0.1:4010', name: 'HeaderOut', timestamp: Date.now() });
  //   const headersOut = activeRequest?.headers.map(([k, v]) => `${k}: ${v}`).join('\n');
  //   timeline.push({ value: headersOut, name: 'HeaderOut', timestamp: Date.now() });
  //   timeline.push({ value: 'HTTP/1.1 101 Switching Protocols', name: 'HeaderIn', timestamp: Date.now() });
  //   const headersIn = response.headers.map(({ name, value }) => `${name}: ${value}`).join('\n');
  //   timeline.push({ value: headersIn, name: 'HeaderIn', timestamp: Date.now() });
  // }

  return (
    <Pane type="response">
      {!response ? <PaneHeader>{ }</PaneHeader> : (
        <PaneHeader className="row-spaced">
          <div className="no-wrap scrollable scrollable--no-bars pad-left">
            <StatusTag statusCode={response.statusCode} statusMessage={response.statusMessage} />
            <TimeTag milliseconds={response.elapsedTime} />
            <SizeTag bytesRead={0} bytesContent={0} />
          </div>
          <ResponseHistoryDropdown
            activeResponse={response}
            handleSetActiveResponse={handleSetActiveResponse}
            requestId={requestId}
            className="tall pane__header__right"
          />
        </PaneHeader>
      )}
      <Tabs className="pane__body theme--pane__body react-tabs">
        <TabList>
          <Tab tabIndex="-1" >
            <button>Events</button>
          </Tab>
          <Tab tabIndex="-1" >
            <button>Timeline</button>
          </Tab>
        </TabList>
        <TabPanel className="react-tabs__tab-panel">
          {Boolean(events?.length) && (
            <EventLogTableWrapper>
              <EventLogTable
                events={events}
                onSelect={handleSelection}
                selectionId={selectedEvent?._id}
              />
            </EventLogTableWrapper>
          )}
          {selectedEvent && (
            <EventLogViewWrapper>
              <EventLogView event={selectedEvent} />
            </EventLogViewWrapper>
          )}
        </TabPanel>
        <TabPanel className="react-tabs__tab-panel">
          <ResponseTimelineViewer
            responseId={response._id}
            timeline={timeline}
          />
        </TabPanel>
      </Tabs>
    </ Pane>
  );
};

export const WebSocketResponsePane: FC<{ requestId: string; handleSetActiveResponse: (requestId: string, activeResponse: Response | null) => void }> = ({
  requestId,
  handleSetActiveResponse,
}) => {
  const wsClient = createWebSocketClient();
  return (
    <WebSocketClientProvider client={wsClient}>
      <ResponsePane
        requestId={requestId}
        handleSetActiveResponse={handleSetActiveResponse}
      />
    </WebSocketClientProvider>
  );
};
