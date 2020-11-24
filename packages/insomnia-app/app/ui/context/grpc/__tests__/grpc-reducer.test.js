// @flow
import { findGrpcRequestState, grpcReducer } from '../grpc-reducer';
import type { GrpcRequestState, GrpcState } from '../grpc-reducer';
import { createBuilder } from '@develohpanda/fluent-builder';
import {
  grpcMessageSchema,
  grpcMethodDefinitionSchema,
  grpcStatusObjectSchema,
  requestStateSchema,
} from '../__schemas__';
import { grpcActions } from '../grpc-actions';
import { globalBeforeEach } from '../../../../__jest__/before-each';
import * as protoLoader from '../../../../network/grpc/proto-loader';
import * as models from '../../../../models';

jest.mock('../../../../network/grpc/proto-loader');

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

describe('findGrpcRequestState', () => {
  it('should return the initial state if not found', () => {
    const state: GrpcState = {
      found: requestStateBuilder.reset().build(),
    };
    expect(findGrpcRequestState(state, 'not-found')).toStrictEqual(expectedInitialState);
  });

  it('should return the request state if found', () => {
    const state: GrpcState = {
      found: requestStateBuilder.reset().build(),
    };
    expect(findGrpcRequestState(state, 'found')).toStrictEqual(state.found);
  });
});

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
        b: requestStateBuilder
          .reset()
          .running(false)
          .build(),
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
        b: requestStateBuilder
          .reset()
          .running(true)
          .build(),
      };
      const newState = grpcReducer(state, grpcActions.stop('b'));

      const expectedRequestState = { ...state.b, running: false };

      expect(newState).toStrictEqual({
        a: state.a,
        b: expectedRequestState,
      });
    });
  });

  describe('requestMessage', () => {
    it('should append request message', () => {
      const existingMessage = messageBuilder.reset().build();
      const state: GrpcState = {
        a: requestStateBuilder.reset().build(),
        b: requestStateBuilder
          .reset()
          .requestMessages([existingMessage])
          .build(),
      };

      const newMessage = '{"prop":"anything"}';
      const newState = grpcReducer(state, grpcActions.requestMessage('b', newMessage));

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
        b: requestStateBuilder
          .reset()
          .responseMessages([existingMessage])
          .build(),
      };

      const newMessage = { prop: 'anything' };
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
        a: requestStateBuilder
          .reset()
          .reloadMethods(false)
          .methods([])
          .build(),
        b: requestStateBuilder
          .reset()
          .reloadMethods(false)
          .build(),
      };

      const newState = grpcReducer(state, grpcActions.invalidate('b'));

      const expectedRequestState = { ...state.b, reloadMethods: true };

      expect(newState).toStrictEqual({
        a: state.a,
        b: expectedRequestState,
      });
    });
  });

  describe('invalidateMany', () => {
    beforeEach(() => {
      globalBeforeEach();
    });

    it('should set reloadMethods to true only for requests that refer to the updated proto file', async () => {
      const parentId = 'wrk_1';

      // Create 3 requests, two of them referencing the protofile in question
      const pf = await models.protoFile.create({ parentId });

      const r1 = 'r1';
      const r2 = 'r2';
      const r3 = 'r3';

      await models.grpcRequest.create({ parentId, _id: r1 });
      await models.grpcRequest.create({ parentId, _id: r2, protoFileId: pf._id });
      await models.grpcRequest.create({ parentId, _id: r3, protoFileId: pf._id });

      // Setup original state for each request
      const originalState: GrpcState = {
        [r1]: requestStateBuilder
          .reset()
          .reloadMethods(false)
          .build(),
        [r2]: requestStateBuilder
          .reset()
          .reloadMethods(false)
          .build(),
        [r3]: requestStateBuilder
          .reset()
          .reloadMethods(false)
          .build(),
      };

      // Dispatch an invalidateMany action, with the modified protofile id as an argument
      const newState = grpcReducer(originalState, await grpcActions.invalidateMany(pf._id));

      // Expect r1 to remain unchanged, while r2 and r3 have reloadMethods set to true
      const r1Expected = originalState[r1];
      const r2Expected = { ...originalState[r2], reloadMethods: true };
      const r3Expected = { ...originalState[r3], reloadMethods: true };

      expect(newState).toStrictEqual({
        [r1]: r1Expected,
        [r2]: r2Expected,
        [r3]: r3Expected,
      });
    });
  });

  describe('clear', () => {
    it('should clear per-run state', () => {
      const state: GrpcState = {
        a: requestStateBuilder
          .reset()
          .running(true)
          .build(),
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

  describe('loadMethods', () => {
    beforeEach(() => {
      globalBeforeEach();
    });

    it('should store methods after they are loaded', async () => {
      const state: GrpcState = {
        a: requestStateBuilder
          .reset()
          .running(true)
          .build(),
        b: requestStateBuilder
          .reset()
          .methods([methodBuilder.reset().build()])
          .reloadMethods(true)
          .build(),
      };

      const newMethods = [methodBuilder.reset().build()];
      protoLoader.loadMethods.mockResolvedValue(newMethods);

      const newState = grpcReducer(state, await grpcActions.loadMethods('b', 'pfid'));

      const expectedRequestState: GrpcRequestState = {
        ...state.b,
        reloadMethods: false,
        methods: newMethods,
      };

      expect(newState).toStrictEqual({
        a: state.a,
        b: expectedRequestState,
      });
    });
  });

  it('should throw error if action not found', () => {
    expect(() => grpcReducer({}, { requestId: 'abc', type: 'not-found' })).toThrowError(
      'Unhandled single request action type: not-found',
    );
  });

  it.each([null, undefined])('should do nothing if action is falsey', action => {
    expect(grpcReducer({}, action)).toStrictEqual({});
  });
});
