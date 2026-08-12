import { describe, expect, it } from 'vitest';

import type { RequestContext } from '../../../insomnia-scripting-environment/src/objects/interfaces';
import { runScriptInQuickJs } from './run-script-quickjs';

const baseContext = (): RequestContext => ({
  request: { _id: 'req_1', name: 'Test request', url: 'https://example.com' } as any,
  timelinePath: '',
  environment: { id: 'env_1', name: 'Base Environment', data: { foo: 'bar' } },
  baseEnvironment: { id: 'env_1', name: 'Base Environment', data: {} },
  timeout: 30_000,
  settings: { timeout: 30_000 } as any,
  clientCertificates: [],
  cookieJar: { cookies: [] } as any,
  requestInfo: {} as any,
  execution: {} as any,
  logs: [],
  transientVariables: { name: 'transientVariables', data: {} },
  parentFolders: [],
});

describe('runScriptInQuickJs', () => {
  it('reads and writes environment variables', async () => {
    const context = baseContext();

    const result = await runScriptInQuickJs({
      script: `
        const current = insomnia.environment.get('foo');
        insomnia.environment.set('foo', current + '-updated');
        insomnia.environment.set('newKey', 42);
      `,
      context,
    });

    expect(result.environment.data).toEqual({ foo: 'bar-updated', newKey: 42 });
  });

  it('reads and writes transient variables', async () => {
    const context = baseContext();

    const result = await runScriptInQuickJs({
      script: `insomnia.variables.set('count', (insomnia.variables.get('count') ?? 0) + 1);`,
      context,
    });

    expect(result.transientVariables?.data).toEqual({ count: 1 });
  });

  it('exposes a read-only insomnia.request', async () => {
    const context = baseContext();

    const result = await runScriptInQuickJs({
      script: `insomnia.environment.set('requestName', insomnia.request.name);`,
      context,
    });

    expect((result.environment.data as Record<string, unknown>).requestName).toBe('Test request');
  });

  it('silently ignores attempts to mutate insomnia.request instead of faking success', async () => {
    const context = baseContext();

    const result = await runScriptInQuickJs({
      script: `
        insomnia.request.name = 'mutated';
        insomnia.environment.set('nameAfterMutationAttempt', insomnia.request.name);
      `,
      context,
    });

    expect((result.environment.data as Record<string, unknown>).nameAfterMutationAttempt).toBe('Test request');
  });

  it('captures console output into logs', async () => {
    const context = baseContext();

    const result = await runScriptInQuickJs({
      script: `console.log('hello from quickjs');`,
      context,
    });

    expect(result.logs.some(row => row.includes('hello from quickjs'))).toBe(true);
  });

  it('throws a clear error when calling the unsupported sendRequest API', async () => {
    const context = baseContext();

    await expect(
      runScriptInQuickJs({ script: 'await insomnia.sendRequest("https://example.com");', context }),
    ).rejects.toThrow(/insomnia\.sendRequest\(\) is not supported/);
  });

  it('propagates script errors with a useful message', async () => {
    const context = baseContext();

    await expect(runScriptInQuickJs({ script: 'throw new Error("boom");', context })).rejects.toThrow('boom');
  });
});
