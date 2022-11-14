import { describe, expect, it } from '@jest/globals';

import { generateId } from '../../../common/misc';
import { isGrpcRequest, isGrpcRequestId } from '../../grpc-request';
import * as models from '../../index';
import { isProtoDirectory } from '../../proto-directory';
import { isProtoFile } from '../../proto-file';
import { isRequest } from '../../request';
import { isRequestGroup } from '../../request-group';
import { isDesign, isWorkspace, WorkspaceScopeKeys } from '../../workspace';

const allTypes = models.types();
const allPrefixes = models.all().map(model => model.prefix);

describe('isGrpcRequest', () => {
  const supported = [models.grpcRequest.type];
  const unsupported = allTypes.filter(x => !supported.includes(x));

  it.each(supported)('should return true: "%s"', type => {
    expect(
      isGrpcRequest({
        type,
      }),
    ).toBe(true);
  });

  it.each(unsupported)('should return false: "%s"', type => {
    expect(
      isGrpcRequest({
        type,
      }),
    ).toBe(false);
  });
});

describe('isGrpcRequestId', () => {
  const supported = [models.grpcRequest.prefix];
  const unsupported = allPrefixes.filter(x => !supported.includes(x));

  it.each(supported)('should return true if id is prefixed by "%s_"', prefix => {
    expect(isGrpcRequestId(generateId(prefix))).toBe(true);
  });

  it.each(unsupported)('should return false if id is prefixed by "%s_"', prefix => {
    expect(isGrpcRequestId(generateId(prefix))).toBe(false);
  });
});

describe('isRequest', () => {
  const supported = [models.request.type];
  const unsupported = allTypes.filter(x => !supported.includes(x));

  it.each(supported)('should return true: "%s"', type => {
    expect(
      isRequest({
        type,
      }),
    ).toBe(true);
  });

  it.each(unsupported)('should return false: "%s"', type => {
    expect(
      isRequest({
        type,
      }),
    ).toBe(false);
  });
});

describe('isRequestGroup', () => {
  const supported = [models.requestGroup.type];
  const unsupported = allTypes.filter(x => !supported.includes(x));

  it.each(supported)('should return true: "%s"', type => {
    expect(
      isRequestGroup({
        type,
      }),
    ).toBe(true);
  });

  it.each(unsupported)('should return false: "%s"', type => {
    expect(
      isRequestGroup({
        type,
      }),
    ).toBe(false);
  });
});

describe('isProtoFile', () => {
  const supported = [models.protoFile.type];
  const unsupported = allTypes.filter(x => !supported.includes(x));

  it.each(supported)('should return true: "%s"', type => {
    expect(
      isProtoFile({
        type,
      }),
    ).toBe(true);
  });

  it.each(unsupported)('should return false: "%s"', type => {
    expect(
      isProtoFile({
        type,
      }),
    ).toBe(false);
  });
});

describe('isProtoDirectory', () => {
  const supported = [models.protoDirectory.type];
  const unsupported = allTypes.filter(x => !supported.includes(x));

  it.each(supported)('should return true: "%s"', type => {
    expect(
      isProtoDirectory({
        type,
      }),
    ).toBe(true);
  });

  it.each(unsupported)('should return false: "%s"', type => {
    expect(
      isProtoDirectory({
        type,
      }),
    ).toBe(false);
  });
});

describe('isWorkspace', () => {
  const supported = [models.workspace.type];
  const unsupported = allTypes.filter(x => !supported.includes(x));

  it.each(supported)('should return true: "%s"', type => {
    expect(
      isWorkspace({
        type,
      }),
    ).toBe(true);
  });

  it.each(unsupported)('should return false: "%s"', type => {
    expect(
      isWorkspace({
        type,
      }),
    ).toBe(false);
  });
});

describe('isDesign', () => {
  it('should be true', () => {
    const w = models.workspace.init();
    w.scope = WorkspaceScopeKeys.design;
    expect(isDesign(w)).toBe(true);
  });

  it('should be false', () => {
    const w = models.workspace.init();
    w.scope = WorkspaceScopeKeys.collection;
    expect(isDesign(w)).toBe(false);
  });
});
