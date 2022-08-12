import { describe, expect, test } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventEmitter from 'events';
import React from 'react';
import { act } from 'react-dom/test-utils';

import { MockCodeEditor } from '../../../__jest__/mock-code-editor';
import { getMockWsClient } from '../../context/websocket-client/test-utils';
import { WebSocketClientProvider } from '../../context/websocket-client/websocket-client-context';
import { UnconnectedResponsePane } from './websocket-response-pane';

jest.mock('../codemirror/code-editor', () => ({
  CodeEditor: MockCodeEditor,
}));

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
    expect(screen.queryByText('Data')).toBeNull();
    expect(screen.queryByText('Time')).toBeNull();
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
      // @TODO: check the table row content as well but after we finalize what we do with the table => react-window?
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

  test('toggles <EventLogView /> when event log item selection is made/removed ', async () => {
    const user = userEvent.setup();
    const mockWebSocketEvent = new EventEmitter();
    const mockWsClient = getMockWsClient(mockWebSocketEvent);
    mockWsClient.event.findMany.mockImplementation(() => (mockInitialEvents));
    render(
      <WebSocketClientProvider client={mockWsClient}>
        <UnconnectedResponsePane requestId={mockWebSocketRequestId} />
      </WebSocketClientProvider>
    );

    const rows = await waitFor(() => {
      const eventRows = screen.queryAllByTestId('EventLogTable__EventTableRow');
      expect(screen.queryAllByTestId('EventLogTable__EventTableRow')).toHaveLength(mockInitialEvents.length);
      return eventRows;
    });

    await user.click(rows[0]);

    const editor: HTMLTextAreaElement | null = screen.queryByTestId('CodeEditor');
    expect(editor).toBeDefined();
    expect(editor?.value).toBe('{"_id":"9c5e2570-6025-4322-9d62-e06b283ab7e8","requestId":"ws-req_34627ce32f22425d8f8571e6e5edb9a9","type":"open","timestamp":1660326519082}');

    await user.click(rows[0]);

    expect(screen.queryByTestId('CodeEditor')).toBeNull();
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

    await waitFor(() => {
      expect(mockWebSocketEvent.listenerCount(eventChannel)).toBe(0);
    });
  });
});
