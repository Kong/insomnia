import EventEmitter from 'events';

export const getMockDbClient = (onChangeEvent: EventEmitter) => {
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
