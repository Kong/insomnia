import { jest } from '@jest/globals';
import EventEmitter from 'events';

export const getMockWsClient = (onChangeEvent: EventEmitter) => {
  return {
    create: jest.fn(),
    close: jest.fn(),
    send: jest.fn(),
    onReadyState: (options: { requestId: string }, listener: (readyState: WebSocket['readyState']) => any) => {
      const channel = `webSocketRequest.connection.${options.requestId}.readyState`;
      onChangeEvent.on(channel, listener);
      return () => onChangeEvent.removeListener(channel, listener);
    },
    getReadyState: jest.fn(),
  };
};
