import { createBuilder } from '@develohpanda/fluent-builder';
import * as grpcJs from '@grpc/grpc-js';

import { globalBeforeEach } from '../../../__jest__/before-each';
import { grpcMocks } from '../../../__mocks__/@grpc/grpc-js';
import { grpcMethodDefinitionSchema } from '../../../ui/context/grpc/__schemas__';
import { grpcIpcMessageParamsSchema } from '../__schemas__/grpc-ipc-message-params-schema';
import { grpcIpcRequestParamsSchema } from '../__schemas__/grpc-ipc-request-params-schema';
import callCache from '../call-cache';
import * as grpc from '../index';
import * as protoLoader from '../proto-loader';
import { ResponseCallbacks as ResponseCallbacksMock } from '../response-callbacks';

jest.mock('../response-callbacks');
jest.mock('../proto-loader');
jest.mock('@grpc/grpc-js');

const requestParamsBuilder = createBuilder(grpcIpcRequestParamsSchema);
const messageParamsBuilder = createBuilder(grpcIpcMessageParamsSchema);
const methodBuilder = createBuilder(grpcMethodDefinitionSchema);
const respond = new ResponseCallbacksMock();

describe('grpc', () => {
  beforeEach(() => {
    globalBeforeEach();
    jest.resetAllMocks();
    requestParamsBuilder.reset();
    messageParamsBuilder.reset();
    methodBuilder.reset();
  });

  describe('grpc.start', () => {
    afterEach(() => {
      // Call cache should always be clear at the end of each test
      expect(callCache.activeCount()).toBe(0);
    });

    it('should exit if method not found', async () => {
      // Arrange
      const params = requestParamsBuilder
        .request({
          _id: 'id',
          protoMethodName: 'SayHi',
          metadata: [],
        })
        .build();
      protoLoader.getSelectedMethod.mockResolvedValue(null);
      // Act
      await grpc.start(params, respond);
      // Assert
      expect(respond.sendStart).not.toHaveBeenCalled();
      expect(respond.sendError).toHaveBeenCalledWith(
        params.request._id,
        new Error(`The gRPC method ${params.request.protoMethodName} could not be found`),
      );
    });

    it('should exit if no url is specified', async () => {
      // Arrange
      const params = requestParamsBuilder
        .request({
          _id: 'id',
          url: '',
          metadata: [],
        })
        .build();
      protoLoader.getSelectedMethod.mockResolvedValue(methodBuilder.build());
      // Act
      await grpc.start(params, respond);
      // Assert
      expect(respond.sendStart).not.toHaveBeenCalled();
      expect(respond.sendError).toHaveBeenCalledWith(
        params.request._id,
        new Error('URL not specified'),
      );
    });

    it('should make a client', async () => {
      // Arrange
      const params = requestParamsBuilder
        .request({
          _id: 'id',
          url: 'grpcb.in:9000',
          metadata: [],
        })
        .build();
      const bidiMethod = methodBuilder.requestStream(true).responseStream(true).build();
      protoLoader.getSelectedMethod.mockResolvedValue(bidiMethod);
      // Act
      await grpc.start(params, respond);
      // Assert
      expect(grpcMocks.mockConstructor).toHaveBeenCalledTimes(1);
      expect(grpcMocks.mockConstructor.mock.calls[0][0]).toBe('grpcb.in:9000');
      expect(grpcMocks.mockCreateInsecure).toHaveBeenCalled();
      expect(grpcMocks.mockCreateSsl).not.toHaveBeenCalled();
      // Cleanup / End the stream
      grpcMocks.getMockCall().emit('end');
    });

    it('should make a secure client', async () => {
      // Arrange
      const params = requestParamsBuilder
        .request({
          _id: 'id',
          url: 'grpcs://grpcb.in:9000',
          metadata: [],
        })
        .build();
      const bidiMethod = methodBuilder.requestStream(true).responseStream(true).build();
      protoLoader.getSelectedMethod.mockResolvedValue(bidiMethod);
      // Act
      await grpc.start(params, respond);
      // Assert
      expect(grpcMocks.mockConstructor).toHaveBeenCalledTimes(1);
      expect(grpcMocks.mockConstructor.mock.calls[0][0]).toBe('grpcb.in:9000');
      expect(grpcMocks.mockCreateInsecure).not.toHaveBeenCalled();
      expect(grpcMocks.mockCreateSsl).toHaveBeenCalled();
      // Cleanup / End the stream
      grpcMocks.getMockCall().emit('end');
    });

    it('should attach status listener', async () => {
      // Arrange
      const params = requestParamsBuilder
        .request({
          _id: 'id',
          url: 'grpcb.in:9000',
          metadata: [],
        })
        .build();
      const bidiMethod = methodBuilder.requestStream(true).responseStream(true).build();
      protoLoader.getSelectedMethod.mockResolvedValue(bidiMethod);
      // Act
      await grpc.start(params, respond);
      // Emit stats
      const status = {
        code: grpcJs.status.OK,
        details: 'OK',
      };
      grpcMocks.getMockCall().emit('status', status);
      // Assert
      expect(respond.sendStatus).toHaveBeenCalledWith(params.request._id, status);
      // Cleanup / End the stream
      grpcMocks.getMockCall().emit('end');
    });

    describe('unary', () => {
      it('should make no request if invalid body', async () => {
        // Arrange
        const params = requestParamsBuilder
          .request({
            _id: 'id',
            url: 'grpcb.in:9000',
            body: {
              text: undefined,
            },
          })
          .build();
        const unaryMethod = methodBuilder.requestStream(false).responseStream(false).build();
        protoLoader.getSelectedMethod.mockResolvedValue(unaryMethod);
        // Act
        await grpc.start(params, respond);
        // Assert
        expect(respond.sendStart).not.toHaveBeenCalled();
        expect(respond.sendError).toHaveBeenCalledWith(
          params.request._id,
          new SyntaxError('Unexpected end of JSON input'),
        );
        expect(grpcMocks.mockMakeUnaryRequest).not.toHaveBeenCalled();
      });

      it('should make unary request with error response', async () => {
        // Arrange
        const params = requestParamsBuilder
          .request({
            _id: 'id',
            url: 'grpcb.in:9000',
            body: {
              text: '{}',
            },
            metadata: [],
          })
          .build();
        const unaryMethod = methodBuilder.requestStream(false).responseStream(false).build();
        protoLoader.getSelectedMethod.mockResolvedValue(unaryMethod);
        // Act
        await grpc.start(params, respond);
        // Assert
        expect(respond.sendStart).toHaveBeenCalledWith(params.request._id);
        expect(grpcMocks.mockMakeUnaryRequest).toHaveBeenLastCalledWith(
          unaryMethod.path,
          unaryMethod.requestSerialize,
          unaryMethod.responseDeserialize,
          {},
          expect.anything(),
          expect.anything(),
        );
        // Trigger response
        const err = {
          code: grpcJs.status.DATA_LOSS,
        };
        const val = undefined;
        grpcMocks.mockMakeUnaryRequest.mock.calls[0][5](err, val);
        // Assert
        expect(respond.sendData).not.toHaveBeenCalled();
        expect(respond.sendError).toHaveBeenCalledWith(params.request._id, err);
        expect(respond.sendEnd).toHaveBeenCalledWith(params.request._id);
      });

      it('should make unary request with valid response', async () => {
        // Arrange
        const params = requestParamsBuilder
          .request({
            _id: 'id',
            url: 'grpcb.in:9000',
            body: {
              text: '{}',
            },
            metadata: [],
          })
          .build();
        const unaryMethod = methodBuilder.requestStream(false).responseStream(false).build();
        protoLoader.getSelectedMethod.mockResolvedValue(unaryMethod);
        // Act
        await grpc.start(params, respond);
        // Assert
        expect(respond.sendStart).toHaveBeenCalledWith(params.request._id);
        expect(grpcMocks.mockMakeUnaryRequest).toHaveBeenLastCalledWith(
          unaryMethod.path,
          unaryMethod.requestSerialize,
          unaryMethod.responseDeserialize,
          {},
          expect.anything(),
          expect.anything(),
        );
        // Trigger response
        const err = undefined;
        const val = {
          foo: 'bar',
        };
        grpcMocks.mockMakeUnaryRequest.mock.calls[0][5](err, val);
        // Assert
        expect(respond.sendError).not.toHaveBeenCalled();
        expect(respond.sendData).toHaveBeenCalledWith(params.request._id, val);
        expect(respond.sendEnd).toHaveBeenCalledWith(params.request._id);
      });
    });

    describe('server streaming', () => {
      it('should make no request if invalid body', async () => {
        // Arrange
        const params = requestParamsBuilder
          .request({
            _id: 'id',
            url: 'grpcb.in:9000',
            body: {
              text: undefined,
            },
            metadata: [],
          })
          .build();
        const serverMethod = methodBuilder.requestStream(false).responseStream(true).build();
        protoLoader.getSelectedMethod.mockResolvedValue(serverMethod);
        // Act
        await grpc.start(params, respond);
        // Assert
        expect(respond.sendStart).not.toHaveBeenCalled();
        expect(respond.sendError).toHaveBeenCalledWith(
          params.request._id,
          new SyntaxError('Unexpected end of JSON input'),
        );
        expect(grpcMocks.mockMakeServerStreamRequest).not.toHaveBeenCalled();
      });

      it('should make server streaming request with valid and error response', async () => {
        // Arrange
        const params = requestParamsBuilder
          .request({
            _id: 'id',
            url: 'grpcb.in:9000',
            body: {
              text: '{}',
            },
            metadata: [],
          })
          .build();
        const serverMethod = methodBuilder.requestStream(false).responseStream(true).build();
        protoLoader.getSelectedMethod.mockResolvedValue(serverMethod);
        // Act
        await grpc.start(params, respond);
        // Assert
        expect(respond.sendStart).toHaveBeenCalledWith(params.request._id);
        expect(grpcMocks.mockMakeServerStreamRequest).toHaveBeenLastCalledWith(
          serverMethod.path,
          serverMethod.requestSerialize,
          serverMethod.responseDeserialize,
          {},
          expect.anything(),
        );
        // Trigger valid response
        const val = {
          foo: 'bar',
        };
        grpcMocks.getMockCall().emit('data', val);
        grpcMocks.getMockCall().emit('data', val);
        // Trigger error response
        const err = {
          code: grpcJs.status.DATA_LOSS,
        };
        grpcMocks.getMockCall().emit('error', err);
        grpcMocks.getMockCall().emit('end');
        // Assert
        expect(respond.sendData).toHaveBeenNthCalledWith(1, params.request._id, val);
        expect(respond.sendData).toHaveBeenNthCalledWith(2, params.request._id, val);
        expect(respond.sendError).toHaveBeenCalledWith(params.request._id, err);
        expect(respond.sendEnd).toHaveBeenCalledWith(params.request._id);
      });
    });

    describe('client streaming', () => {
      it('should make client streaming request with error response', async () => {
        // Arrange
        const params = requestParamsBuilder
          .request({
            _id: 'id',
            url: 'grpcb.in:9000',
            metadata: [],
          })
          .build();
        const clientMethod = methodBuilder.requestStream(true).responseStream(false).build();
        protoLoader.getSelectedMethod.mockResolvedValue(clientMethod);
        // Act
        await grpc.start(params, respond);
        // Assert
        expect(respond.sendStart).toHaveBeenCalledWith(params.request._id);
        expect(grpcMocks.mockMakeClientStreamRequest).toHaveBeenLastCalledWith(
          clientMethod.path,
          clientMethod.requestSerialize,
          clientMethod.responseDeserialize,
          expect.anything(),
          expect.anything(),
        );
        // Trigger response
        const err = {
          code: grpcJs.status.DATA_LOSS,
        };
        const val = undefined;
        grpcMocks.mockMakeClientStreamRequest.mock.calls[0][4](err, val);
        // Assert
        expect(respond.sendData).not.toHaveBeenCalled();
        expect(respond.sendError).toHaveBeenCalledWith(params.request._id, err);
        expect(respond.sendEnd).toHaveBeenCalledWith(params.request._id);
      });

      it('should make client streaming request with valid response', async () => {
        // Arrange
        const params = requestParamsBuilder
          .request({
            _id: 'id',
            url: 'grpcb.in:9000',
            metadata: [],
          })
          .build();
        const clientMethod = methodBuilder.requestStream(true).responseStream(false).build();
        protoLoader.getSelectedMethod.mockResolvedValue(clientMethod);
        // Act
        await grpc.start(params, respond);
        // Assert
        expect(respond.sendStart).toHaveBeenCalledWith(params.request._id);
        expect(grpcMocks.mockMakeClientStreamRequest).toHaveBeenLastCalledWith(
          clientMethod.path,
          clientMethod.requestSerialize,
          clientMethod.responseDeserialize,
          expect.anything(),
          expect.anything(),
        );
        // Trigger response
        const err = undefined;
        const val = {
          foo: 'bar',
        };
        grpcMocks.mockMakeClientStreamRequest.mock.calls[0][4](err, val);
        // Assert
        expect(respond.sendError).not.toHaveBeenCalled();
        expect(respond.sendData).toHaveBeenCalledWith(params.request._id, val);
        expect(respond.sendEnd).toHaveBeenCalledWith(params.request._id);
      });
    });

    describe('bidi streaming', () => {
      it('should make bidi streaming request with valid and error response', async () => {
        // Arrange
        const params = requestParamsBuilder
          .request({
            _id: 'id',
            url: 'grpcb.in:9000',
            metadata: [],
          })
          .build();
        const bidiMethod = methodBuilder.requestStream(true).responseStream(true).build();
        protoLoader.getSelectedMethod.mockResolvedValue(bidiMethod);
        // Act
        await grpc.start(params, respond);
        // Assert
        expect(respond.sendStart).toHaveBeenCalledWith(params.request._id);
        expect(grpcMocks.mockMakeBidiStreamRequest).toHaveBeenLastCalledWith(
          bidiMethod.path,
          bidiMethod.requestSerialize,
          bidiMethod.responseDeserialize,
          expect.anything()
        );
        // Trigger valid response
        const val = {
          foo: 'bar',
        };
        grpcMocks.getMockCall().emit('data', val);
        grpcMocks.getMockCall().emit('data', val);
        // Trigger error response
        const err = {
          code: grpcJs.status.DATA_LOSS,
        };
        grpcMocks.getMockCall().emit('error', err);
        grpcMocks.getMockCall().emit('end');
        // Assert
        expect(respond.sendData).toHaveBeenNthCalledWith(1, params.request._id, val);
        expect(respond.sendData).toHaveBeenNthCalledWith(2, params.request._id, val);
        expect(respond.sendError).toHaveBeenCalledWith(params.request._id, err);
        expect(respond.sendEnd).toHaveBeenCalledWith(params.request._id);
      });
    });
  });

  describe('grpc.sendMessage', () => {
    const _makeClient = async () => {
      const params = requestParamsBuilder
        .request({
          _id: 'id',
          url: 'grpcb.in:9000',
          metadata: [],
        })
        .build();
      const clientMethod = methodBuilder.requestStream(true).responseStream(false).build();
      protoLoader.getSelectedMethod.mockResolvedValue(clientMethod);
      await grpc.start(params, respond);
      return params;
    };

    it('should not send a message with invalid body contents', async () => {
      // Arrange
      const reqParams = await _makeClient();
      const msgParams = messageParamsBuilder
        .body({
          text: undefined,
        })
        .requestId(reqParams.request._id)
        .build();
      // Act
      grpc.sendMessage(msgParams, respond);
      // Assert
      expect(respond.sendError).toHaveBeenCalledWith(
        msgParams.requestId,
        new SyntaxError('Unexpected end of JSON input'),
      );
    });

    it('should send a message', async () => {
      // Arrange
      const reqParams = await _makeClient();
      const msgParams = messageParamsBuilder.requestId(reqParams.request._id).build();
      // Act
      grpc.sendMessage(msgParams, respond);
      setTimeout(() => {
        // Assert
        expect(respond.sendError).not.toHaveBeenCalled();
        expect(grpcMocks.mockCallWrite).toHaveBeenCalledWith({});
      });
    });

    it('should not send a message if a call is not found', () => {
      // Arrange
      const msgParams = messageParamsBuilder.build();
      const mockWrite = jest.fn();
      grpcMocks.getMockCall().on('write', mockWrite);
      // Act
      grpc.sendMessage(msgParams, respond);
      // Assert
      setTimeout(() => {
        // Assert
        expect(respond.sendError).not.toHaveBeenCalled();
        expect(grpcMocks.mockCallWrite).not.toHaveBeenCalled();
      });
    });
  });

  describe('grpc.commit', () => {
    const _makeClient = async () => {
      const params = requestParamsBuilder
        .request({
          _id: 'id',
          url: 'grpcb.in:9000',
          metadata: [],
        })
        .build();
      const clientMethod = methodBuilder.requestStream(true).responseStream(false).build();
      protoLoader.getSelectedMethod.mockResolvedValue(clientMethod);
      await grpc.start(params, respond);
      return params;
    };

    it('should commit', async () => {
      // Arrange
      const reqParams = await _makeClient();
      // Act
      grpc.commit(reqParams.request._id);
      // Assert
      expect(grpcMocks.mockCallEnd).toHaveBeenCalled();
    });

    it('should not commit if a call is not found', () => {
      // Act
      grpc.commit('another id');
      // Assert
      expect(grpcMocks.mockCallEnd).not.toHaveBeenCalled();
    });
  });

  describe('grpc.cancel', () => {
    const _makeClient = async () => {
      const params = requestParamsBuilder
        .request({
          _id: 'id',
          url: 'grpcb.in:9000',
          metadata: [],
        })
        .build();
      const clientMethod = methodBuilder.requestStream(true).responseStream(false).build();
      protoLoader.getSelectedMethod.mockResolvedValue(clientMethod);
      await grpc.start(params, respond);
      return params;
    };

    it('should commit', async () => {
      // Arrange
      const reqParams = await _makeClient();
      // Act
      grpc.cancel(reqParams.request._id);
      // Assert
      expect(grpcMocks.mockCallCancel).toHaveBeenCalled();
    });

    it('should not commit if a call is not found', () => {
      // Act
      grpc.cancel('another id');
      // Assert
      expect(grpcMocks.mockCallCancel).not.toHaveBeenCalled();
    });
  });
});
