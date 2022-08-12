import { describe, expect, test } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import EventEmitter from 'events';
import React from 'react';
import { act } from 'react-dom/test-utils';

import { getMockWsClient } from '../../context/websocket-client/test-utils';
import { WebSocketClientProvider } from '../../context/websocket-client/websocket-client-context';
import { UnconnectedResponsePane } from './websocket-response-pane';

const mockWebSocketRequestId = 'ws-req_34627ce32f22425d8f8571e6e5edb9a9';

const mockInitialEvents = [
  {
    '_id': '9c5e2570-6025-4322-9d62-e06b283ab7e8',
    'requestId': mockWebSocketRequestId,
    'type': 'open',
    'timestamp': 1660326519082,
  },
  {
    '_id': 'f430d235-205a-44ac-bc60-cfb5a4379b29',
    'requestId': mockWebSocketRequestId,
    'code': 1005,
    'reason': '',
    'type': 'close',
    'wasClean': true,
    'timestamp': 1660326520271,
  },
];

const mockMessageEvent = {
  '_id': 'bcd4e15d-f696-4823-bc28-37cffce548d3',
  'requestId': mockWebSocketRequestId,
  'data': '{"type":"subscriptions","channels":[{"name":"level2","product_ids":["BTC-USD"]}]}',
  'type': 'message',
  'direction': 'INCOMING',
  'timestamp': 1660324563759,
};

describe('<WebSocketResponsePane />', () => {
  test('renders without exploding', async () => {
    const mockWebSocketEvent = new EventEmitter();
    const mockWsClient = getMockWsClient(mockWebSocketEvent);
    render(
      <WebSocketClientProvider client={mockWsClient}>
        <UnconnectedResponsePane requestId={mockWebSocketRequestId} />
      </WebSocketClientProvider>
    );

    expect(screen.getByText('Events')).toBeDefined();

    // there is no events to begin with
    await waitFor(() => {
      expect(screen.queryByTestId('EventLogTabe__Table')).toBeNull();
    });
  });

  test('renders preloaded events', async () => {
    const mockWebSocketEvent = new EventEmitter();
    const mockWsClient = getMockWsClient(mockWebSocketEvent);
    mockWsClient.event.findMany.mockImplementation(() => (mockInitialEvents));
    render(
      <WebSocketClientProvider client={mockWsClient}>
        <UnconnectedResponsePane requestId={mockWebSocketRequestId} />
      </WebSocketClientProvider>
    );

    expect(screen.getByText('Events')).toBeDefined();
    expect(await screen.findByText('Data')).toBeDefined();
    expect(screen.getByText('Time')).toBeDefined();

    await waitFor(() => {
      expect(screen.queryAllByTestId('EventLogTable__EventTableRow')).toHaveLength(mockInitialEvents.length);
    });
  });

  test('appends a new event', async () => {
    const mockWebSocketEvent = new EventEmitter();
    const mockWsClient = getMockWsClient(mockWebSocketEvent);
    mockWsClient.event.findMany.mockImplementation(() => (mockInitialEvents));
    render(
      <WebSocketClientProvider client={mockWsClient}>
        <UnconnectedResponsePane requestId={mockWebSocketRequestId} />
      </WebSocketClientProvider>
    );

    await waitFor(() => {
      expect(screen.queryAllByTestId('EventLogTable__EventTableRow')).toHaveLength(mockInitialEvents.length);
    });

    expect(screen.getByText('Events')).toBeDefined();
    expect(screen.getByText('Data')).toBeDefined();
    expect(screen.getByText('Time')).toBeDefined();

    act(() => {
      const eventChannel = `webSocketRequest.connection.${mockWebSocketRequestId}.event`;
      mockWebSocketEvent.emit(eventChannel, mockMessageEvent);
    });

    expect(screen.queryAllByTestId('EventLogTable__EventTableRow')).toHaveLength(mockInitialEvents.length + 1);
  });

  test('removes event listener when unmounted', async () => {
    const mockWebSocketEvent = new EventEmitter();
    const mockWsClient = getMockWsClient(mockWebSocketEvent);
    mockWsClient.event.findMany.mockImplementation(() => (mockInitialEvents));
    const { unmount } = render(
      <WebSocketClientProvider client={mockWsClient}>
        <UnconnectedResponsePane requestId={mockWebSocketRequestId} />
      </WebSocketClientProvider>
    );

    await waitFor(() => {
      expect(screen.queryAllByTestId('EventLogTable__EventTableRow')).toHaveLength(mockInitialEvents.length);
    });

    const eventChannel = `webSocketRequest.connection.${mockWebSocketRequestId}.event`;
    expect(mockWebSocketEvent.listenerCount(eventChannel)).toBe(1);
    expect(screen.getByText('Events')).toBeDefined();
    expect(screen.getByText('Data')).toBeDefined();
    expect(screen.getByText('Time')).toBeDefined();

    unmount();

    expect(mockWebSocketEvent.listenerCount(eventChannel)).toBe(0);
  });
});
