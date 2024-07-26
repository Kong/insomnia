import grpcJSOriginal from '@grpc/grpc-js';
import { EventEmitter } from 'events';
import { vi } from 'vitest';

const grpcJs = vi.requireActual('@grpc/grpc-js') as typeof grpcJSOriginal;

const mockCallWrite = vi.fn();
const mockCallEnd = vi.fn();
const mockCallCancel = vi.fn();

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

const mockConstructor = vi.fn();
const mockMakeUnaryRequest = vi.fn();
const mockMakeClientStreamRequest = vi.fn();
const mockMakeServerStreamRequest = vi.fn();
const mockMakeBidiStreamRequest = vi.fn();
const mockCreateInsecure = vi.fn();
const mockCreateSsl = vi.fn();

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
