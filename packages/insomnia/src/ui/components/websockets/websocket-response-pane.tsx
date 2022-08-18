import React, { FC, useEffect, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import styled from 'styled-components';

import { ResponseTimelineEntry } from '../../../main/network/libcurl-promise';
import { WebsocketEvent, WebsocketUpgradeEvent } from '../../../main/network/websocket';
import { createWebSocketClient } from '../../context/websocket-client/create-websocket-client';
import { useWebSocketConnectionEvents } from '../../context/websocket-client/use-ws-connection-events';
import { WebSocketClientProvider } from '../../context/websocket-client/websocket-client-context';
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
const fakeResponse: { _id: string} = {
  _id: 'test',
};
export const ResponsePane: FC<{ requestId: string }> = ({
  requestId,
}) => {
  const [selectedEvent, setSelectedEvent] = useState<WebsocketEvent | null>(
    null
  );
  const events = useWebSocketConnectionEvents({ requestId });
  const handleSelection = (event: WebsocketEvent) => {
    setSelectedEvent((selected: WebsocketEvent | null) => selected?._id === event._id ? null : event);
  };

  useEffect(() => {
    setSelectedEvent(null);
  }, []);
  // @TODO: temporary workaround until response model is decided
  const upgradeResponse = events.slice().reverse().find(({ type }) => type === 'upgrade') as WebsocketUpgradeEvent;
  const timeline: ResponseTimelineEntry[] = [];
  if (upgradeResponse) {
    timeline.push({ value: 'Preparing request to ws://example.com/chat', name: 'Text', timestamp: Date.now() });
    timeline.push({ value: `Current time is ${new Date().toISOString()}`, name: 'Text', timestamp: Date.now() });
    timeline.push({ value: 'Using HTTP 1.1', name: 'Text', timestamp: Date.now() });
    timeline.push({ value: 'UPGRADE /chat HTTP/1.1\r\nHost: 127.0.0.1:4010', name: 'HeaderOut', timestamp: Date.now() });
    const headersOut = Object.entries(upgradeResponse.outgoingHeaders).map(([k, v]) => `${k}:${v}`).join('\n');
    timeline.push({ value: headersOut, name: 'HeaderOut', timestamp: Date.now() });
    timeline.push({ value: 'HTTP/1.1 101 Switching Protocols', name: 'HeaderIn', timestamp: Date.now() });
    const headersIn = Object.entries(upgradeResponse.incomingHeaders).map(([k, v]) => `${k}:${v}`).join('\n');
    timeline.push({ value: headersIn, name: 'HeaderIn', timestamp: Date.now() });
  }

  return (
    <Pane type="response">
      {!upgradeResponse ? <PaneHeader>{ }</PaneHeader> : (
        <PaneHeader className="row-spaced">
          <div className="no-wrap scrollable scrollable--no-bars pad-left">
            <StatusTag statusCode={upgradeResponse.statusCode || 1000} statusMessage={upgradeResponse.statusMessage} />
            <TimeTag milliseconds={upgradeResponse.elapsedTime} />
            <SizeTag bytesRead={0} bytesContent={0} />
          </div>
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
            responseId={fakeResponse._id}
            timeline={timeline}
          />
        </TabPanel>
      </Tabs>
    </ Pane>
  );
};

export const WebSocketResponsePane: FC<{ requestId: string }> = ({ requestId }) => {
  const wsClient = createWebSocketClient();
  return (
    <WebSocketClientProvider client={wsClient}>
      <ResponsePane requestId={requestId} />
    </WebSocketClientProvider>
  );
};
