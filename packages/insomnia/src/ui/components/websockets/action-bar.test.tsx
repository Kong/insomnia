import { describe, expect, test } from '@jest/globals';
import { waitFor } from '@testing-library/dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventEmitter from 'events';
import React from 'react';

import { NeDBClientProvider } from '../../context/nedb-client/nedb-client-context';
import { getMockDbClient } from '../../context/nedb-client/test-utils';
import { getMockWsClient } from '../../context/websocket-client/test-utils';
import { ReadyState } from '../../context/websocket-client/use-ws-ready-state';
import { WebSocketClientProvider } from '../../context/websocket-client/websocket-client-context';
import { WebsocketActionBar } from './action-bar';

const mockWebSocketRequest = {
  created: 1659705610169,
  metaSortKey: -1659820403328,
  modified: 1659966388437,
  name: 'vawfwef',
  parentId: 'wrk_04c0dd5b689f4403850dc375079f91e8',
  type: 'WebSocketRequest',
  url: 'wss://ws-feed.exchange.coinbase.com',
  _id: 'ws-req_41a7383adef4406eabf0b5bd23594375',
};

describe('<WebSocketActionBar />', () => {
  test('renders without exploding', async () => {
    const mockOnChangeEvent = new EventEmitter();
    const mockDbClient = getMockDbClient(mockOnChangeEvent);

    const mockOnReadyState = new EventEmitter();
    const mockWsClient = getMockWsClient(mockOnReadyState);

    mockDbClient.query.getWhere.mockImplementation(() => Promise.resolve(mockWebSocketRequest));
    mockWsClient.getReadyState.mockImplementation(() => Promise.resolve(0));

    render(
      <NeDBClientProvider client={mockDbClient}>
        <WebSocketClientProvider client={mockWsClient}>
          <WebsocketActionBar requestId={mockWebSocketRequest._id} />
        </WebSocketClientProvider>
      </NeDBClientProvider>
    );

    const urlInput: HTMLInputElement = screen.getByPlaceholderText('wss://ws-feed.exchange.coinbase.com');
    expect(urlInput).toBeDefined();
    expect(screen.queryByRole('button', { name: 'websocketActionConnectBtn' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'websocketActionCloseBtn' })).toBeNull();
    await waitFor(() => {
      expect(urlInput.value).toBe('wss://ws-feed.exchange.coinbase.com');
    });
  });

  test('renders without url when url is not defined', async () => {
    const mockOnChangeEvent = new EventEmitter();
    const mockDbClient = getMockDbClient(mockOnChangeEvent);

    const mockOnReadyState = new EventEmitter();
    const mockWsClient = getMockWsClient(mockOnReadyState);

    const { url, ...rest } = mockWebSocketRequest;
    mockDbClient.query.getWhere.mockImplementation(() => Promise.resolve(rest));
    mockWsClient.getReadyState.mockImplementation(() => Promise.resolve(0));

    render(
      <NeDBClientProvider client={mockDbClient}>
        <WebSocketClientProvider client={mockWsClient}>
          <WebsocketActionBar requestId={mockWebSocketRequest._id} />
        </WebSocketClientProvider>
      </NeDBClientProvider>
    );

    const urlInput: HTMLInputElement = screen.getByPlaceholderText('wss://ws-feed.exchange.coinbase.com');
    expect(urlInput).toBeDefined();
    expect(screen.queryByRole('button', { name: 'websocketActionConnectBtn' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'websocketActionCloseBtn' })).toBeNull();
    await waitFor(() => {
      expect(urlInput.value).toBe('');
    });
  });

  test('handles websocket ready state: open', async () => {
    const user = userEvent.setup();

    const mockOnChangeEvent = new EventEmitter();
    const mockDbClient = getMockDbClient(mockOnChangeEvent);

    const mockOnReadyState = new EventEmitter();
    const mockWsClient = getMockWsClient(mockOnReadyState);

    mockDbClient.query.getWhere.mockImplementation(() => Promise.resolve(mockWebSocketRequest));
    mockWsClient.getReadyState.mockImplementation(() => Promise.resolve(0));
    mockWsClient.create.mockImplementation(() => {
      mockOnReadyState.emit(`webSocketRequest.connection.${mockWebSocketRequest._id}.readyState`, ReadyState.OPEN);
    });
    render(
      <NeDBClientProvider client={mockDbClient}>
        <WebSocketClientProvider client={mockWsClient}>
          <WebsocketActionBar requestId={mockWebSocketRequest._id} />
        </WebSocketClientProvider>
      </NeDBClientProvider>
    );

    const urlInput: HTMLInputElement = screen.getByPlaceholderText('wss://ws-feed.exchange.coinbase.com');
    expect(urlInput).toBeDefined();

    const connectBtn = screen.getByText('Connect');
    expect(connectBtn).toBeDefined();

    await user.click(connectBtn);

    await waitFor(() => {
      expect(urlInput.disabled).toBe(true);
      expect(screen.queryByText('Connect')).toBeNull();
      expect(screen.getByText('Close')).toBeDefined();
    });
  });

  test('calls create method when Connect button is clicked', async () => {
    const user = userEvent.setup();

    const mockOnChangeEvent = new EventEmitter();
    const mockDbClient = getMockDbClient(mockOnChangeEvent);

    const mockOnReadyState = new EventEmitter();
    const mockWsClient = getMockWsClient(mockOnReadyState);

    mockDbClient.query.getWhere.mockImplementation(() => Promise.resolve(mockWebSocketRequest));
    mockWsClient.getReadyState.mockImplementation(() => Promise.resolve(0));

    render(
      <NeDBClientProvider client={mockDbClient}>
        <WebSocketClientProvider client={mockWsClient}>
          <WebsocketActionBar requestId={mockWebSocketRequest._id} />
        </WebSocketClientProvider>
      </NeDBClientProvider>
    );

    const urlInput: HTMLInputElement = screen.getByPlaceholderText('wss://ws-feed.exchange.coinbase.com');
    expect(urlInput).toBeDefined();

    const connectBtn = screen.getByText('Connect');
    expect(connectBtn).toBeDefined();

    await user.click(connectBtn);

    expect(mockWsClient.create).toHaveBeenCalled();
  });

  test('calls close method when Close button is clicked', async () => {
    const user = userEvent.setup();

    const mockOnChangeEvent = new EventEmitter();
    const mockDbClient = getMockDbClient(mockOnChangeEvent);

    const mockOnReadyState = new EventEmitter();
    const mockWsClient = getMockWsClient(mockOnReadyState);

    mockDbClient.query.getWhere.mockImplementation(() => Promise.resolve(mockWebSocketRequest));
    mockWsClient.create.mockImplementation(() => {
      mockOnReadyState.emit(`webSocketRequest.connection.${mockWebSocketRequest._id}.readyState`, ReadyState.OPEN);
    });
    mockWsClient.getReadyState.mockImplementation(() => Promise.resolve(0));
    render(
      <NeDBClientProvider client={mockDbClient}>
        <WebSocketClientProvider client={mockWsClient}>
          <WebsocketActionBar requestId={mockWebSocketRequest._id} />
        </WebSocketClientProvider>
      </NeDBClientProvider>
    );

    const urlInput: HTMLInputElement = screen.getByPlaceholderText('wss://ws-feed.exchange.coinbase.com');
    expect(urlInput).toBeDefined();

    const connectBtn = screen.getByText('Connect');
    expect(connectBtn).toBeDefined();

    await user.click(connectBtn);

    await waitFor(() => {
      expect(screen.getByText('Close')).toBeDefined();
    });

    await user.click(screen.getByText('Close'));

    expect(mockWsClient.close).toHaveBeenCalled();
  });
});
