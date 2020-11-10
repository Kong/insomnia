// @flow

import { ipcRenderer } from 'electron';
import { GrpcResponseEventEnum } from '../../../../common/grpc-events';
import { grpcStatusObjectSchema } from '../__schemas__';
import { createBuilder } from '@develohpanda/fluent-builder';
import { grpcIpcRenderer } from '../grpc-ipc-renderer';
import { grpcActions } from '../grpc-actions';

jest.mock('../grpc-actions', () => ({
  grpcActions: {
    start: jest.fn(),
    stop: jest.fn(),
    responseMessage: jest.fn(),
    error: jest.fn(),
    status: jest.fn(),
  },
}));

describe('init', () => {
  const e = {};
  const id = 'abc';
  const dispatch = jest.fn();

  beforeEach(() => {
    grpcIpcRenderer.init(dispatch);
  });

  it.each(Object.values(GrpcResponseEventEnum))('should add listener for channel: %s', channel => {
    expect(ipcRenderer.on).toHaveBeenCalledWith(channel, expect.anything());
  });

  it('should attach listener for start', () => {
    const [channel, listener] = ipcRenderer.on.mock.calls[0];

    expect(channel).toBe(GrpcResponseEventEnum.start);

    // Execute the callback, and make sure the correct grpc action is called
    listener(e, id);
    expect(grpcActions.start).toHaveBeenCalledWith(id);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('should attach listener for end', () => {
    const [channel, listener] = ipcRenderer.on.mock.calls[1];

    expect(channel).toBe(GrpcResponseEventEnum.end);

    // Execute the callback, and make sure the correct grpc action is called
    listener(e, id);
    expect(grpcActions.stop).toHaveBeenCalledWith(id);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('should attach listener for data', () => {
    const [channel, listener] = ipcRenderer.on.mock.calls[2];
    const val = { a: true };

    expect(channel).toBe(GrpcResponseEventEnum.data);

    // Execute the callback, and make sure the correct grpc action is called
    listener(e, id, val);
    expect(grpcActions.responseMessage).toHaveBeenCalledWith(id, val);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('should attach listener for error', () => {
    const [channel, listener] = ipcRenderer.on.mock.calls[3];
    const err = new Error('error');

    expect(channel).toBe(GrpcResponseEventEnum.error);

    // Execute the callback, and make sure the correct grpc action is called
    listener(e, id, err);
    expect(grpcActions.error).toHaveBeenCalledWith(id, err);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('should attach listener for status', () => {
    const [channel, listener] = ipcRenderer.on.mock.calls[4];
    const status = createBuilder(grpcStatusObjectSchema).build();

    expect(channel).toBe(GrpcResponseEventEnum.status);

    // Execute the callback, and make sure the correct grpc action is called
    listener(e, id, status);
    expect(grpcActions.status).toHaveBeenCalledWith(id, status);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});

describe('destroy', () => {
  it.each(Object.values(GrpcResponseEventEnum))(
    'should remove listeners for channel: %s',
    channel => {
      grpcIpcRenderer.destroy();
      expect(ipcRenderer.removeAllListeners).toHaveBeenCalledWith(channel);
    },
  );
});
