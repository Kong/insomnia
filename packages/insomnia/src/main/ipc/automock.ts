// From https://github.com/bloomrpc/bloomrpc-mock/blob/master/src/automock.ts
// TODO simplify this and rename to generate example payload
import { Enum, Field, MapField, Message, OneOf, Service, Type } from 'protobufjs';
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
        data = mockTypeFields(messageType, new StackDepth());
      }
      return { plain: data, message: messageType.fromObject(data) };
    };

    return methods;
  }, {});
}

/**
 * Mock a field type
 */
function mockTypeFields(type: Type, stackDepth: StackDepth): object {
  if (stackDepth.incrementAndCheckIfOverMax(`$type.${type.name}`)) {
    return {};
  }

  const fieldsData: { [key: string]: any } = {};
  if (!type.fieldsArray) {
    return fieldsData;
  }
  return type.fieldsArray.reduce((data, field) => {
    const resolvedField = field.resolve();

    if (resolvedField.parent !== resolvedField.resolvedType) {
      if (resolvedField.repeated) {
        data[resolvedField.name] = [mockField(resolvedField, stackDepth)];
      } else {
        data[resolvedField.name] = mockField(resolvedField, stackDepth);
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
function mockField(field: Field, stackDepth: StackDepth): any {
  if (stackDepth.incrementAndCheckIfOverMax(`$field.${field.name}`)) {
    return {};
  }

  if (field instanceof MapField) {
    return mockMapField(field, stackDepth);
  }

  if (field.resolvedType instanceof Enum) {
    return mockEnum(field.resolvedType);
  }

  if (isProtoType(field.resolvedType)) {
    return mockTypeFields(field.resolvedType, stackDepth);
  }

  const mockPropertyValue = mockScalar(field.type, field.name);

  if (mockPropertyValue === null) {
    const resolvedField = field.resolve();

    return mockField(resolvedField, stackDepth);
  } else {
    return mockPropertyValue;
  }
}

function mockMapField(field: MapField, stackDepth: StackDepth): any {
  let mockPropertyValue = null;
  if (field.resolvedType === null) {
    mockPropertyValue = mockScalar(field.type, field.name);
  }

  if (mockPropertyValue === null) {
    const resolvedType = field.resolvedType;

    if (resolvedType instanceof Type) {
      if (resolvedType.oneofs) {
        mockPropertyValue = pickOneOf(resolvedType.oneofsArray, stackDepth);
      } else {
        mockPropertyValue = mockTypeFields(resolvedType, stackDepth);
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

function isProtoType(resolvedType: Enum | Type | null): resolvedType is Type {
  if (!resolvedType) {
    return false;
  }
  const fieldsArray: keyof Type = 'fieldsArray';
  return resolvedType instanceof Type || (
    fieldsArray in resolvedType && Array.isArray(resolvedType[fieldsArray])
  );
}

function pickOneOf(oneofs: OneOf[], stackDepth: StackDepth) {
  return oneofs.reduce((fields: {[key: string]: any}, oneOf) => {
    fields[oneOf.name] = mockField(oneOf.fieldsArray[0], stackDepth);
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
      return Buffer.from([0xa1, 0xb2, 0xc3]);
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

class StackDepth {
  private readonly depths: { [type: string]: number };
  readonly maxStackSize: number;

  constructor(maxStackSize = 3) {
    this.depths = {};
    this.maxStackSize = maxStackSize;
  }

  incrementAndCheckIfOverMax(key: string): boolean {
    if (this.depths[key] > this.maxStackSize) {
      return true;
    }
    if (!this.depths[key]) {
      this.depths[key] = 0;
    }
    this.depths[key]++;
    return false;
  }
}
