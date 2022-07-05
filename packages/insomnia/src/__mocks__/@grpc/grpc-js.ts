import grpcJSOriginal from '@grpc/grpc-js';
import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

const grpcJs = jest.requireActual('@grpc/grpc-js') as typeof grpcJSOriginal;

const mockCallWrite = jest.fn();
const mockCallEnd = jest.fn();
const mockCallCancel = jest.fn();

export const status = grpcJs.status;

class MockCall extends EventEmitter {
  write(...args) {
    mockCallWrite(...args);
  }

  end(...args) {
    mockCallEnd(...args);
  }

  cancel(...args) {
    mockCallCancel(...args);
  }
}

let mockCall = new MockCall();

const makeMockCall = () => {
  mockCall = new MockCall();
};

const getMockCall = () => mockCall;

const mockConstructor = jest.fn();
const mockMakeUnaryRequest = jest.fn();
const mockMakeClientStreamRequest = jest.fn();
const mockMakeServerStreamRequest = jest.fn();
const mockMakeBidiStreamRequest = jest.fn();
const mockCreateInsecure = jest.fn();
const mockCreateSsl = jest.fn();

export const grpcMocks = {
  getMockCall,
  mockConstructor,
  mockMakeUnaryRequest,
  mockMakeClientStreamRequest,
  mockMakeServerStreamRequest,
  mockMakeBidiStreamRequest,
  mockCreateInsecure,
  mockCreateSsl,
  mockCallWrite,
  mockCallEnd,
  mockCallCancel,
};

class MockGrpcClient {
  constructor(...args) {
    mockConstructor(...args);
  }

  makeUnaryRequest(...args) {
    mockMakeUnaryRequest(...args);
    makeMockCall();
    return getMockCall();
  }

  makeClientStreamRequest(...args) {
    mockMakeClientStreamRequest(...args);
    makeMockCall();
    return getMockCall();
  }

  makeServerStreamRequest(...args) {
    mockMakeServerStreamRequest(...args);
    makeMockCall();
    return getMockCall();
  }

  makeBidiStreamRequest(...args) {
    mockMakeBidiStreamRequest(...args);
    makeMockCall();
    return getMockCall();
  }

}

export function makeGenericClientConstructor() {
  return MockGrpcClient;
}

export class Metadata {
  /**
   * Mock Metadata class to avoid TypeError: grpc.Metadata is not a constructor
   */
  constructor() {
    // Do nothing
  }
}

export const credentials = {
  createInsecure: mockCreateInsecure,
  createSsl: mockCreateSsl,
};
