import { describe, expect, test } from '@jest/globals';
import { waitFor } from '@testing-library/dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventEmitter from 'events';
import React from 'react';

import { NeDBClientContext } from '../../../context/nedb-client/nedb-client-context';
import { ReadyState } from '../../../context/websocket-client/use-ws-ready-state';
import { WebSocketClientContext } from '../../../context/websocket-client/websocket-client-context';
import { WebsocketActionBar } from './action-bar';
import { mockWebSocketRequest } from './action-bar.mock';

describe('<WebSocketActionBar />', () => {
  const getMockDbClient = (onChangeEvent: EventEmitter) => {
    return {
      query: {
        all: jest.fn(),
        getWhere: jest.fn(),
      },
      mutation: {
        docUpdate: jest.fn(),
      },
      onChange: (channel: string, listener: (event: any, ...args: any[]) => void) => {
        onChangeEvent.on(channel, listener);
        return () => onChangeEvent.removeListener(channel, listener);
      },
    };
  };

  const getMockWsClient = (onChangeEvent: EventEmitter) => {
    return {
      create: jest.fn(),
      close: jest.fn(),
      send: jest.fn(),
      onReadyState: (options: { requestId: string }, listener: (readyState: WebSocket['readyState']) => any) => {
        const channel = `webSocketRequest.connection.${options.requestId}.readyState`;
        onChangeEvent.on(channel, listener);
        return () => onChangeEvent.removeListener(channel, listener);
      },
    };
  };

  test('renders without exploding', async () => {
    const mockOnChangeEvent = new EventEmitter();
    const mockDbClient = getMockDbClient(mockOnChangeEvent);

    const mockOnReadyState = new EventEmitter();
    const mockWsClient = getMockWsClient(mockOnReadyState);

    mockDbClient.query.getWhere.mockImplementation(() => Promise.resolve(mockWebSocketRequest));

    render(
      <NeDBClientContext.Provider value={mockDbClient}>
        <WebSocketClientContext.Provider value={mockWsClient}>
          <WebsocketActionBar requestId={mockWebSocketRequest._id} />
        </WebSocketClientContext.Provider>
      </NeDBClientContext.Provider>
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

    render(
      <NeDBClientContext.Provider value={mockDbClient}>
        <WebSocketClientContext.Provider value={mockWsClient}>
          <WebsocketActionBar requestId={mockWebSocketRequest._id} />
        </WebSocketClientContext.Provider>
      </NeDBClientContext.Provider>
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
    mockWsClient.create.mockImplementation(() => {
      mockOnReadyState.emit(`webSocketRequest.connection.${mockWebSocketRequest._id}.readyState`, ReadyState.OPEN);
    });
    render(
      <NeDBClientContext.Provider value={mockDbClient}>
        <WebSocketClientContext.Provider value={mockWsClient}>
          <WebsocketActionBar requestId={mockWebSocketRequest._id} />
        </WebSocketClientContext.Provider>
      </NeDBClientContext.Provider>
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

    render(
      <NeDBClientContext.Provider value={mockDbClient}>
        <WebSocketClientContext.Provider value={mockWsClient}>
          <WebsocketActionBar requestId={mockWebSocketRequest._id} />
        </WebSocketClientContext.Provider>
      </NeDBClientContext.Provider>
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
    render(
      <NeDBClientContext.Provider value={mockDbClient}>
        <WebSocketClientContext.Provider value={mockWsClient}>
          <WebsocketActionBar requestId={mockWebSocketRequest._id} />
        </WebSocketClientContext.Provider>
      </NeDBClientContext.Provider>
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
