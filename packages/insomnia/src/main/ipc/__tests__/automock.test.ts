import { it } from '@jest/globals';
import { parse } from 'protobufjs';

import { mockRequestMethods } from '../automock';

it('mocks simple requests', () => {
  const parsed = parse(`
    syntax = "proto3";

    message FooRequest {
        string foo = 1;
    }

    message FooResponse {
        string foo = 1;
    }

    service FooService {
        rpc Foo (FooRequest) returns (FooResponse);
    }`);

  const service = parsed.root.lookupService('FooService');
  const mocked = mockRequestMethods(service);

  const plain = mocked['Foo']().plain;
  expect(plain).toStrictEqual({
    foo: 'Hello',
  });
});

it('mocks requests with nested objects', () => {
  const parsed = parse(`
    syntax = "proto3";

    message BarBarObject {
        int32 one = 1;
    }

    message BarObject {
        BarBarObject fuzz = 1;
    }

    message FooRequest {
        BarObject bar = 2;
    }

    message FooResponse {
        string foo = 1;
    }

    service FooService {
        rpc Foo (FooRequest) returns (FooResponse);
    }`);

  const service = parsed.root.lookupService('FooService');
  const mocked = mockRequestMethods(service);

  const plain = mocked['Foo']().plain;
  expect(plain).toStrictEqual({
    bar: {
      fuzz: {
        one: 10,
      },
    },
  });
});

it('mocks requests with enums', () => {
  const parsed = parse(`
    syntax = "proto3";

    enum MyEnum {
        MYENUM_UNSPECIFIED = 0;
        MYENUM_A = 1;
        MYENUM_B = 2;
    }

    message FooRequest {
        MyEnum enum = 1;
    }

    message FooResponse {
        string foo = 1;
    }

    service FooService {
        rpc Foo (FooRequest) returns (FooResponse);
    }`);

  const service = parsed.root.lookupService('FooService');
  const mocked = mockRequestMethods(service);

  const plain = mocked['Foo']().plain;
  expect(plain).toStrictEqual({
    enum: 0,
  });
});

it('mocks requests with repeated values', () => {
  const parsed = parse(`
    syntax = "proto3";

    message FooRequest {
        repeated string foo = 1;
    }

    message FooResponse {
        string foo = 1;
    }

    service FooService {
        rpc Foo (FooRequest) returns (FooResponse);
    }`);

  const service = parsed.root.lookupService('FooService');
  const mocked = mockRequestMethods(service);

  const plain = mocked['Foo']().plain;
  expect(plain).toStrictEqual({
    foo: ['Hello'],
  });
});
