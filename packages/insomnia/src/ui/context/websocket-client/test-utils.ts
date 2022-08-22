import { jest } from '@jest/globals';
import EventEmitter from 'events';

import { WebSocketEvent } from '../../../main/network/websocket';
import { ReadyState } from './use-ws-ready-state';

export const getMockWsClient = (onChangeEvent: EventEmitter) => {
  return {
    event: {
      findMany: jest.fn(),
      send: jest.fn(),
      subscribe: (options: { requestId: string }, listener: (event: WebSocketEvent) => any) => {
        const channel = `webSocketRequest.connection.${options.requestId}.event`;
        onChangeEvent.on(channel, listener);
        return () => onChangeEvent.removeListener(channel, listener);
      },
    },
    create: jest.fn(),
    close: jest.fn(),
    send: jest.fn(),
    onReadyState: (options: { requestId: string }, listener: (readyState: ReadyState) => any) => {
      const channel = `webSocketRequest.connection.${options.requestId}.readyState`;
      onChangeEvent.on(channel, listener);
      return () => onChangeEvent.removeListener(channel, listener);
    },
    getReadyState: jest.fn(),
  };
};
