import * as models from '../../index';
import { difference } from 'lodash';
import {
  isGrpcRequest,
  isGrpcRequestId,
  isProtoFile,
  isRequest,
  isRequestGroup,
  isRequestId,
} from '../is-model';
import { generateId } from '../../../common/misc';

const allTypes = models.types();
const allPrefixes = models.all().map(model => model.prefix);

describe('isGrpcRequest', () => {
  const supported = [models.grpcRequest.type];
  const unsupported = difference(allTypes, supported);

  it.each(supported)('should return true: "%s"', type => {
    expect(isGrpcRequest({ type })).toBe(true);
  });

  it.each(unsupported)('should return false: "%s"', type => {
    expect(isGrpcRequest({ type })).toBe(false);
  });
});

describe('isGrpcRequestId', () => {
  const supported = [models.grpcRequest.prefix];
  const unsupported = difference(allPrefixes, supported);

  it.each(supported)('should return true if id is prefixed by "%s_"', prefix => {
    expect(isGrpcRequestId(generateId(prefix))).toBe(true);
  });

  it.each(unsupported)('should return false if id is prefixed by "%s_"', prefix => {
    expect(isGrpcRequestId(generateId(prefix))).toBe(false);
  });
});

describe('isRequest', () => {
  const supported = [models.request.type];
  const unsupported = difference(allTypes, supported);

  it.each(supported)('should return true: "%s"', type => {
    expect(isRequest({ type })).toBe(true);
  });

  it.each(unsupported)('should return false: "%s"', type => {
    expect(isRequest({ type })).toBe(false);
  });
});

describe('isRequestId', () => {
  const supported = [models.request.prefix];
  const unsupported = difference(allPrefixes, supported);

  it.each(supported)('should return true if id is prefixed by "%s_"', prefix => {
    expect(isRequestId(generateId(prefix))).toBe(true);
  });

  it.each(unsupported)('should return false if id is prefixed by "%s_"', prefix => {
    expect(isRequestId(generateId(prefix))).toBe(false);
  });
});

describe('isRequestGroup', () => {
  const supported = [models.requestGroup.type];
  const unsupported = difference(allTypes, supported);

  it.each(supported)('should return true: "%s"', type => {
    expect(isRequestGroup({ type })).toBe(true);
  });

  it.each(unsupported)('should return false: "%s"', type => {
    expect(isRequestGroup({ type })).toBe(false);
  });
});

describe('isProtoFile', () => {
  const supported = [models.protoFile.type];
  const unsupported = difference(allTypes, supported);

  it.each(supported)('should return true: "%s"', type => {
    expect(isProtoFile({ type })).toBe(true);
  });

  it.each(unsupported)('should return false: "%s"', type => {
    expect(isProtoFile({ type })).toBe(false);
  });
});
