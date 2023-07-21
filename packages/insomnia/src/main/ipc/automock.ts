// From https://github.com/bloomrpc/bloomrpc-mock/blob/master/src/automock.ts
import type { Field, Message, OneOf, Service } from 'protobufjs';
import { Enum, MapField, Type } from 'protobufjs';
import { v4 } from 'uuid';

export interface MethodPayload {
  plain: {[key: string]: any};
  message: Message;
}

export interface ServiceMethodsPayload {
  [name: string]: () => MethodPayload;
}

const enum MethodType {
  request,
  response
}

const MAX_STACK_SIZE = 3;

/**
 * Mock method response
 */
export function mockResponseMethods(
  service: Service,
  mocks?: void | {},
) {
  return mockMethodReturnType(
    service,
    MethodType.response,
    mocks
  );
}

/**
 * Mock methods request
 */
export function mockRequestMethods(
  service: Service,
  mocks?: void | {},
) {
  return mockMethodReturnType(
    service,
    MethodType.request,
    mocks
  );
}

function mockMethodReturnType(
  service: Service,
  type: MethodType,
  mocks?: void | {},
): ServiceMethodsPayload {
  const root = service.root;
  const serviceMethods = service.methods;

  return Object.keys(serviceMethods).reduce((methods: ServiceMethodsPayload, method: string) => {
    const serviceMethod = serviceMethods[method];

    const methodMessageType = type === MethodType.request
      ? serviceMethod.requestType
      : serviceMethod.responseType;

    const messageType = root.lookupType(methodMessageType);

    methods[method] = () => {
      let data = {};
      if (!mocks) {
        data = mockTypeFields(messageType);
      }
      return { plain: data, message: messageType.fromObject(data) };
    };

    return methods;
  }, {});
}

interface StackDepth {
  [type: string]: number;
}
/**
 * Mock a field type
 */
function mockTypeFields(type: Type, stackDepth: StackDepth = {}): object {
  if (stackDepth[type.name] > MAX_STACK_SIZE) {
    return {};
  }
  if (!stackDepth[type.name]) {
    stackDepth[type.name] = 0;
  }
  stackDepth[type.name]++;

  const fieldsData: { [key: string]: any } = {};
  if (!type.fieldsArray) {
    return fieldsData;
  }
  return type.fieldsArray.reduce((data, field) => {
    field.resolve();

    if (field.parent !== field.resolvedType) {
      if (field.repeated) {
        data[field.name] = [mockField(field, stackDepth)];
      } else {
        data[field.name] = mockField(field, stackDepth);
      }
    }

    return data;
  }, fieldsData);
}

/**
 * Mock enum
 */
function mockEnum(enumType: Enum): number {
  const enumKey = Object.keys(enumType.values)[0];

  return enumType.values[enumKey];
}

/**
 * Mock a field
 */
function mockField(field: Field, stackDepth?: StackDepth): any {
  if (field instanceof MapField) {
    let mockPropertyValue = null;
    if (field.resolvedType === null) {
      mockPropertyValue = mockScalar(field.type, field.name);
    }

    if (mockPropertyValue === null) {
      const resolvedType = field.resolvedType;

      if (resolvedType instanceof Type) {
        if (resolvedType.oneofs) {
          mockPropertyValue = pickOneOf(resolvedType.oneofsArray);
        } else {
          mockPropertyValue = mockTypeFields(resolvedType);
        }
      } else if (resolvedType instanceof Enum) {
        mockPropertyValue = mockEnum(resolvedType);
      } else if (resolvedType === null) {
        mockPropertyValue = {};
      }
    }

    return {
      [mockScalar(field.keyType, field.name)]: mockPropertyValue,
    };
  }

  if (field.resolvedType instanceof Type || !!field.resolvedType?.name) {
    return mockTypeFields(field.resolvedType as Type, stackDepth);
  }

  if (field.resolvedType instanceof Enum) {
    return mockEnum(field.resolvedType);
  }

  const mockPropertyValue = mockScalar(field.type, field.name);

  if (mockPropertyValue === null) {
    const resolvedField = field.resolve();

    return mockField(resolvedField, stackDepth);
  } else {
    return mockPropertyValue;
  }
}

function pickOneOf(oneofs: OneOf[]) {
  return oneofs.reduce((fields: {[key: string]: any}, oneOf) => {
    fields[oneOf.name] = mockField(oneOf.fieldsArray[0]);
    return fields;
  }, {});
}

function mockScalar(type: string, fieldName: string): any {
  switch (type) {
    case 'string':
      return interpretMockViaFieldName(fieldName);
    case 'number':
      return 10;
    case 'bool':
      return true;
    case 'int32':
      return 10;
    case 'int64':
      return 20;
    case 'uint32':
      return 100;
    case 'uint64':
      return 100;
    case 'sint32':
      return 100;
    case 'sint64':
      return 1200;
    case 'fixed32':
      return 1400;
    case 'fixed64':
      return 1500;
    case 'sfixed32':
      return 1600;
    case 'sfixed64':
      return 1700;
    case 'double':
      return 1.4;
    case 'float':
      return 1.1;
    case 'bytes':
      return Buffer.from([0xa1, 0xb2, 0xc3]).toString('base64');
    default:
      return null;
  }
}

/**
 * Tries to guess a mock value from the field name.
 * Default Hello.
 */
function interpretMockViaFieldName(fieldName: string): string {
  const fieldNameLower = fieldName.toLowerCase();

  if (fieldNameLower.startsWith('id') || fieldNameLower.endsWith('id')) {
    return v4();
  }

  return 'Hello';
}
