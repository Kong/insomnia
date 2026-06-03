import { generateId } from 'insomnia-data/common';
import { describe, expect, it } from 'vitest';

import * as models from './';
import type { AllTypes } from './types';

const { isProtoDirectory } = models.protoDirectory;
const { isProtoFile } = models.protoFile;
const { isRequest } = models.request;
const { isRequestGroup } = models.requestGroup;

const allTypes = models.types();
const allPrefixes = models.all().map(model => model.prefix);

describe('isGrpcRequest', () => {
  const supported: AllTypes[] = [models.grpcRequest.type];
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
  const supported: AllTypes[] = [models.request.type];
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
  const supported: AllTypes[] = [models.requestGroup.type];
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
  const supported: AllTypes[] = [models.protoFile.type];
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
  const supported: AllTypes[] = [models.protoDirectory.type];
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
  const supported: AllTypes[] = [models.workspace.type];
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
