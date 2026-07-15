import { describe, expect, it } from 'vitest';

import { deserializeRenderContext, serializeRenderContext } from '../render-context-serialization';

const makeContext = () => ({
  // environment data
  foo: 'bar',
  nested: { a: 1 },
  DEFAULT_HEADERS: [{ name: 'X', value: 'y' }],
  // helper functions
  getMeta: () => ({ requestId: 'req_1', workspaceId: 'wrk_1' }),
  getEnvironmentId: () => 'env_1',
  getExtraInfo: () => ({ extra: true }),
  getGlobalEnvironmentId: () => 'genv_1',
  getKeysContext: () => ({ keyContext: {} }),
  getProjectId: () => 'proj_1',
  getPurpose: () => 'send',
  getSettings: () => ({ dataFolders: [] }),
});

describe('serializeRenderContext', () => {
  it('strips functions so the result is structured-clone safe', () => {
    const serialized = serializeRenderContext(makeContext());

    expect(Object.values(serialized).some(v => typeof v === 'function')).toBe(false);
    // structuredClone throws on functions; this must not throw
    expect(() => structuredClone(serialized)).not.toThrow();
  });

  it('preserves environment data and resolves helper values into serializedFunctions', () => {
    const serialized = serializeRenderContext(makeContext());

    expect(serialized.foo).toBe('bar');
    expect(serialized.nested).toEqual({ a: 1 });
    expect(serialized.serializedFunctions).toEqual({
      requestId: 'req_1',
      workspaceId: 'wrk_1',
      environmentId: 'env_1',
      extraInfo: { extra: true },
      globalEnvironmentId: 'genv_1',
      keysContext: { keyContext: {} },
      projectId: 'proj_1',
      purpose: 'send',
      settings: { dataFolders: [] },
    });
  });
});

describe('deserializeRenderContext', () => {
  it('rebuilds the helper functions from serializedFunctions after a clone round-trip', () => {
    const roundTripped = structuredClone(serializeRenderContext(makeContext()));
    const context = deserializeRenderContext(roundTripped);

    expect(context.getMeta()).toEqual({ requestId: 'req_1', workspaceId: 'wrk_1' });
    expect(context.getProjectId()).toBe('proj_1');
    expect(context.getEnvironmentId()).toBe('env_1');
    expect(context.getSettings()).toEqual({ dataFolders: [] });
    // environment data survives the round-trip
    expect(context.foo).toBe('bar');
  });
});
