import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RequestContext } from '../../../insomnia-scripting-environment/src/objects/interfaces';
import { runScriptInQuickJs } from './quickjs-script-engine';

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

  it('propagates script errors with a useful message', async () => {
    const context = baseContext();

    await expect(runScriptInQuickJs({ script: 'throw new Error("boom");', context })).rejects.toThrow('boom');
  });
});

describe('runScriptInQuickJs sendRequest bridge', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubFetchOnce = (response: { ok: boolean; status?: number; body: unknown }) => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      text: () => Promise.resolve(JSON.stringify(response.body)),
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('sends a real request through the bridge and resolves with a response object', async () => {
    stubFetchOnce({
      ok: true,
      body: {
        code: 200,
        status: 'OK',
        headers: [{ name: 'content-type', value: 'application/json' }],
        body: '{"hello":"world"}',
        responseTime: 12,
      },
    });
    const context = baseContext();

    const result = await runScriptInQuickJs({
      script: `
        const response = await insomnia.sendRequest('https://example.com');
        insomnia.environment.set('code', response.code);
        insomnia.environment.set('parsedBody', response.json());
      `,
      context,
    });

    expect(result.environment.data).toMatchObject({ code: 200, parsedBody: { hello: 'world' } });
  });

  it('sends the auth token as a header on the bridge fetch call', async () => {
    const fetchMock = stubFetchOnce({
      ok: true,
      body: { code: 204, status: 'No Content', headers: [], body: '', responseTime: 1 },
    });
    const context = baseContext();

    await runScriptInQuickJs({
      script: `await insomnia.sendRequest('https://example.com');`,
      context,
      authToken: 'super-secret-token',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'insomnia-templating-worker-database://network.sendrequestwithoutsideeffects',
      expect.objectContaining({ headers: { 'x-insomnia-templating-auth': 'super-secret-token' } }),
    );
  });

  it('normalizes a plain-object request with headers and a string body', async () => {
    const fetchMock = stubFetchOnce({
      ok: true,
      body: { code: 200, status: 'OK', headers: [], body: '', responseTime: 1 },
    });
    const context = baseContext();

    await runScriptInQuickJs({
      script: `
        await insomnia.sendRequest({
          url: 'https://example.com/items',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"a":1}',
        });
      `,
      context,
    });

    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody).toEqual({
      options: {
        request: {
          url: 'https://example.com/items',
          method: 'POST',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          body: { mimeType: 'text/plain', text: '{"a":1}' },
        },
        caCertficatePath: null,
      },
    });
  });

  it('supports the Postman-style (error, response) callback signature', async () => {
    stubFetchOnce({ ok: true, body: { code: 200, status: 'OK', headers: [], body: 'ok', responseTime: 1 } });
    const context = baseContext();

    const result = await runScriptInQuickJs({
      script: `
        await new Promise((resolve) => {
          insomnia.sendRequest('https://example.com', (error, response) => {
            insomnia.environment.set('callbackError', error ?? null);
            insomnia.environment.set('callbackBody', response ? response.body : null);
            resolve();
          });
        });
      `,
      context,
    });

    expect(result.environment.data).toMatchObject({ callbackError: null, callbackBody: 'ok' });
  });

  it('rejects with the bridge-reported error when the host handler fails', async () => {
    stubFetchOnce({ ok: false, status: 500, body: { error: 'DNS resolution failed' } });
    const context = baseContext();

    await expect(
      runScriptInQuickJs({ script: `await insomnia.sendRequest('https://unreachable.invalid');`, context }),
    ).rejects.toThrow('DNS resolution failed');
  });

  it('reports the bridge error to the callback instead of throwing when a callback is given', async () => {
    stubFetchOnce({ ok: false, status: 500, body: { error: 'DNS resolution failed' } });
    const context = baseContext();

    const result = await runScriptInQuickJs({
      script: `
        await new Promise((resolve) => {
          insomnia.sendRequest('https://unreachable.invalid', (error) => {
            insomnia.environment.set('callbackError', error);
            resolve();
          });
        });
      `,
      context,
    });

    expect((result.environment.data as Record<string, unknown>).callbackError).toBe('DNS resolution failed');
  });
});
