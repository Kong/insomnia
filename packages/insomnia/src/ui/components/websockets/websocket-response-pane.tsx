import React, { FC, useEffect, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import styled from 'styled-components';

import { ResponseTimelineEntry } from '../../../main/network/libcurl-promise';
import { WebsocketEvent } from '../../../main/network/websocket';
import * as models from '../../../models';
import type { Response } from '../../../models/response';
import { useWebSocketConnectionEvents } from '../../context/websocket-client/use-ws-connection-events';
import { ResponseHistoryDropdown } from '../dropdowns/response-history-dropdown';
import { ErrorBoundary } from '../error-boundary';
import { Pane, PaneHeader as OriginalPaneHeader } from '../panes/pane';
import { SizeTag } from '../tags/size-tag';
import { StatusTag } from '../tags/status-tag';
import { TimeTag } from '../tags/time-tag';
import { ResponseHeadersViewer } from '../viewers/response-headers-viewer';
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
const PaneBodyContent = styled.div({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
});
export const WebSocketResponsePane: FC<{ requestId: string; response: Response; handleSetActiveResponse: (requestId: string, activeResponse: Response | null) => void }> = ({
  requestId,
  response,
  handleSetActiveResponse,
}) => {
  const [selectedEvent, setSelectedEvent] = useState<WebsocketEvent | null>(
    null
  );
  const events = useWebSocketConnectionEvents({ responseId: response?._id });
  const handleSelection = (event: WebsocketEvent) => {
    setSelectedEvent((selected: WebsocketEvent | null) => selected?._id === event._id ? null : event);
  };

  useEffect(() => {
    setSelectedEvent(null);
  }, []);
  let timeline: ResponseTimelineEntry[] = [];
  if (response) {
    timeline = models.response.getTimeline(response);
  }

  return (
    <Pane type="response">
      {!response ? <PaneHeader /> : (
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
          <Tab tabIndex="-1">
            <button>
              Headers{' '}
              {response?.headers.length > 0 && (
                <span className="bubble">{response.headers.length}</span>
              )}
            </button>
          </Tab>
          <Tab tabIndex="-1" >
            <button>Timeline</button>
          </Tab>
        </TabList>
        <TabPanel className="react-tabs__tab-panel">
          <PaneBodyContent>
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
          </PaneBodyContent>
        </TabPanel>
        <TabPanel className="react-tabs__tab-panel scrollable-container">
          <div className="scrollable pad">
            {response && <ErrorBoundary key={response._id} errorClassName="font-error pad text-center">
              <ResponseHeadersViewer headers={response.headers} />
            </ErrorBoundary>}
          </div>
        </TabPanel>
        <TabPanel className="react-tabs__tab-panel">
          <ResponseTimelineViewer
            responseId={response?._id || ''}
            timeline={timeline}
          />
        </TabPanel>
      </Tabs>
    </ Pane>
  );
};
