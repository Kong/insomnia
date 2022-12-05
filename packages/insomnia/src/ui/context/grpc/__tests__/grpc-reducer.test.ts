import { createBuilder } from '@develohpanda/fluent-builder';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  grpcMessageSchema,
  grpcMethodDefinitionSchema,
  grpcStatusObjectSchema,
  requestStateSchema,
} from '../__schemas__';
import { grpcActions } from '../grpc-actions';
import type { GrpcRequestState, GrpcState } from '../grpc-reducer';
import { grpcReducer } from '../grpc-reducer';

const messageBuilder = createBuilder(grpcMessageSchema);
const requestStateBuilder = createBuilder(requestStateSchema);
const statusBuilder = createBuilder(grpcStatusObjectSchema);
const methodBuilder = createBuilder(grpcMethodDefinitionSchema);
const expectedInitialState: GrpcRequestState = {
  running: false,
  requestMessages: [],
  responseMessages: [],
  status: undefined,
  error: undefined,
  methods: [],
  reloadMethods: true,
};

describe('grpcReducer actions', () => {
  const mockDateNowResult = 1234;
  const _originalDateNow = Date.now;
  beforeEach(() => {
    Date.now = jest.fn().mockReturnValue(mockDateNowResult);
  });

  afterEach(() => {
    Date.now = _originalDateNow;
  });

  describe('reset', () => {
    it('should set the request state to be the initial state', () => {
      const state: GrpcState = {
        a: requestStateBuilder.reset().build(),
        b: requestStateBuilder
          .reset()
          .running(true)
          .responseMessages([messageBuilder.build()])
          .build(),
      };
      const newState = grpcReducer(state, grpcActions.reset('b'));
      const expectedRequestState = expectedInitialState;
      expect(newState).toStrictEqual({
        a: state.a,
        b: expectedRequestState,
      });
    });
  });

  describe('start', () => {
    it('should set running to true', () => {
      const state: GrpcState = {
        a: requestStateBuilder.reset().build(),
        b: requestStateBuilder.reset().running(false).build(),
      };
      const newState = grpcReducer(state, grpcActions.start('b'));
      const expectedRequestState = { ...state.b, running: true };
      expect(newState).toStrictEqual({
        a: state.a,
        b: expectedRequestState,
      });
    });
  });

  describe('stop', () => {
    it('should set running to false', () => {
      const state: GrpcState = {
        a: requestStateBuilder.reset().build(),
        b: requestStateBuilder.reset().running(true).build(),
      };
      const newState = grpcReducer(state, grpcActions.stop('b'));
      const expectedRequestState = { ...state.b, running: false };
      expect(newState).toStrictEqual({
        a: state.a,
        b: expectedRequestState,
      });
    });
  });

  describe('requestStream', () => {
    it('should append request message', () => {
      const existingMessage = messageBuilder.reset().build();
      const state: GrpcState = {
        a: requestStateBuilder.reset().build(),
        b: requestStateBuilder.reset().requestMessages([existingMessage]).build(),
      };
      const newMessage = '{"prop":"anything"}';
      const newState = grpcReducer(state, grpcActions.requestStream('b', newMessage));
      const expectedMessage = expect.objectContaining({
        id: expect.stringMatching(/^[a-z0-9]{32}$/),
        text: newMessage,
        created: mockDateNowResult,
      });
      const expectedRequestState = {
        ...state.b,
        requestMessages: [existingMessage, expectedMessage],
      };
      expect(newState).toStrictEqual({
        a: state.a,
        b: expectedRequestState,
      });
    });
  });

  describe('responseMessage', () => {
    it('should append response message', () => {
      const existingMessage = messageBuilder.reset().build();
      const state: GrpcState = {
        a: requestStateBuilder.reset().build(),
        b: requestStateBuilder.reset().responseMessages([existingMessage]).build(),
      };
      const newMessage = {
        prop: 'anything',
      };
      const newState = grpcReducer(state, grpcActions.responseMessage('b', newMessage));
      const expectedMessage = expect.objectContaining({
        id: expect.stringMatching(/^[a-z0-9]{32}$/),
        text: '{"prop":"anything"}',
        created: mockDateNowResult,
      });
      const expectedRequestState = {
        ...state.b,
        responseMessages: [existingMessage, expectedMessage],
      };
      expect(newState).toStrictEqual({
        a: state.a,
        b: expectedRequestState,
      });
    });
  });

  describe('error', () => {
    it('should set error', () => {
      const state: GrpcState = {
        a: requestStateBuilder.reset().build(),
        b: requestStateBuilder.reset().build(),
      };
      const error = new Error('this is an error');
      const newState = grpcReducer(state, grpcActions.error('b', error));
      const expectedRequestState = { ...state.b, error };
      expect(newState).toStrictEqual({
        a: state.a,
        b: expectedRequestState,
      });
    });
  });

  describe('status', () => {
    it('should set status', () => {
      const state: GrpcState = {
        a: requestStateBuilder.reset().build(),
        b: requestStateBuilder.reset().build(),
      };
      const status = statusBuilder.reset().build();
      const newState = grpcReducer(state, grpcActions.status('b', status));
      const expectedRequestState = { ...state.b, status };
      expect(newState).toStrictEqual({
        a: state.a,
        b: expectedRequestState,
      });
    });
  });

  describe('invalidate', () => {
    it('should set reloadMethods to true', () => {
      const state: GrpcState = {
        a: requestStateBuilder.reset().reloadMethods(false).methods([]).build(),
        b: requestStateBuilder.reset().reloadMethods(false).build(),
      };
      const newState = grpcReducer(state, grpcActions.invalidate('b'));
      const expectedRequestState = { ...state.b, reloadMethods: true };
      expect(newState).toStrictEqual({
        a: state.a,
        b: expectedRequestState,
      });
    });
  });

  describe('clear', () => {
    it('should clear per-run state', () => {
      const state: GrpcState = {
        a: requestStateBuilder.reset().running(true).build(),
        b: requestStateBuilder
          .reset()
          .reloadMethods(true)
          .methods([methodBuilder.reset().build()])
          .running(true)
          .requestMessages([messageBuilder.reset().build()])
          .responseMessages([messageBuilder.reset().build()])
          .status(statusBuilder.reset().build())
          .error(new Error('error'))
          .build(),
      };
      const newState = grpcReducer(state, grpcActions.clear('b'));
      const expectedRequestState = {
        ...state.b,
        requestMessages: [],
        responseMessages: [],
        status: undefined,
        error: undefined,
      };
      expect(newState).toStrictEqual({
        a: state.a,
        b: expectedRequestState,
      });
    });
  });

  it('should throw error if action not found', () => {
    expect(() =>
      grpcReducer(
        {},
        {
          requestId: 'abc',
          type: 'not-found',
        },
      ),
    ).toThrowError('Unhandled single request action type: not-found');
  });

  it.each([null, undefined])('should do nothing if action is falsey', action => {
    expect(grpcReducer({}, action)).toStrictEqual({});
  });
});
