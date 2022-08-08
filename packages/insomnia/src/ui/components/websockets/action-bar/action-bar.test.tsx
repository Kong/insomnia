import { describe, expect, test } from '@jest/globals';
import { waitFor } from '@testing-library/dom';
import { render, screen } from '@testing-library/react';
import EventEmitter from 'events';
import React from 'react';

import { NeDBClientContext } from '../nedb-client-context';
import { WebSocketClientContext } from '../websocket-client-context';
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
          <WebsocketActionBar requestId='someRequest' />
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
});
