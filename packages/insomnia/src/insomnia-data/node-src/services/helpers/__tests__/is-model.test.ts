import { describe, expect, it } from 'vitest';

import { models } from '~/insomnia-data';
import { generateId } from '~/insomnia-data/common';

const allTypes = models.types();
const allPrefixes = models.all().map(model => model.prefix);

describe('isGrpcRequest', () => {
  const supported = [models.grpcRequest.type];
  const unsupported = allTypes.filter(x => !supported.includes(x));

  it.each(supported)('should return true: "%s"', type => {
    expect(
      models.grpcRequest.isGrpcRequest({
        type,
      }),
    ).toBe(true);
  });

  it.each(unsupported)('should return false: "%s"', type => {
    expect(
      models.grpcRequest.isGrpcRequest({
        type,
      }),
    ).toBe(false);
  });
});

describe('isGrpcRequestId', () => {
  const supported = [models.grpcRequest.prefix];
  const unsupported = allPrefixes.filter(x => !supported.includes(x));

  it.each(supported)('should return true if id is prefixed by "%s_"', prefix => {
    expect(models.grpcRequest.isGrpcRequestId(generateId(prefix))).toBe(true);
  });

  it.each(unsupported)('should return false if id is prefixed by "%s_"', prefix => {
    expect(models.grpcRequest.isGrpcRequestId(generateId(prefix))).toBe(false);
  });
});

describe('isRequest', () => {
  const supported = [models.request.type];
  const unsupported = allTypes.filter(x => !supported.includes(x));

  it.each(supported)('should return true: "%s"', type => {
    expect(
      models.request.isRequest({
        type,
      }),
    ).toBe(true);
  });

  it.each(unsupported)('should return false: "%s"', type => {
    expect(
      models.request.isRequest({
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
      models.requestGroup.isRequestGroup({
        type,
      }),
    ).toBe(true);
  });

  it.each(unsupported)('should return false: "%s"', type => {
    expect(
      models.requestGroup.isRequestGroup({
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
      models.protoFile.isProtoFile({
        type,
      }),
    ).toBe(true);
  });

  it.each(unsupported)('should return false: "%s"', type => {
    expect(
      models.protoFile.isProtoFile({
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
      models.protoDirectory.isProtoDirectory({
        type,
      }),
    ).toBe(true);
  });

  it.each(unsupported)('should return false: "%s"', type => {
    expect(
      models.protoDirectory.isProtoDirectory({
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
      models.workspace.isWorkspace({
        type,
      }),
    ).toBe(true);
  });

  it.each(unsupported)('should return false: "%s"', type => {
    expect(
      models.workspace.isWorkspace({
        type,
      }),
    ).toBe(false);
  });
});

describe('isDesign', () => {
  it('should be true', () => {
    const w = models.workspace.init();
    w.scope = models.workspace.WorkspaceScopeKeys.design;
    expect(models.workspace.isDesign(w)).toBe(true);
  });

  it('should be false', () => {
    const w = models.workspace.init();
    w.scope = models.workspace.WorkspaceScopeKeys.collection;
    expect(models.workspace.isDesign(w)).toBe(false);
  });
});
