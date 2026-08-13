import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RequestContext } from '../../../insomnia-scripting-environment/src/objects/interfaces';
import { getQuickJSModule } from '../templating/sandbox/quickjs-runtime';
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

  it('does not let a "__proto__" key rewire the returned environment data\'s own prototype', async () => {
    const context = baseContext();

    const result = await runScriptInQuickJs({
      script: `
        insomnia.environment.set('__proto__', { polluted: true });
        insomnia.environment.set('after', 'marker');
      `,
      context,
    });

    expect(Object.getPrototypeOf(result.environment.data)).toBe(Object.prototype);
    expect((result.environment.data as Record<string, unknown>).polluted).toBeUndefined();
    expect((result.environment.data as Record<string, unknown>).after).toBe('marker');
    // The shared Object.prototype itself stays untouched.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('does not let a "constructor"/"prototype" key rewire the returned environment data', async () => {
    const context = baseContext();

    const result = await runScriptInQuickJs({
      script: `
        insomnia.environment.set('constructor', { polluted: true });
        insomnia.environment.set('prototype', { polluted: true });
      `,
      context,
    });

    expect(typeof result.environment.data.constructor).not.toBe('object');
    expect((result.environment.data as Record<string, unknown>).prototype).toBeUndefined();
  });

  it("keeps globalThis limited to standard intrinsics and this sandbox's own bridged names", async () => {
    const context = baseContext();

    // Reports host globals and the full globalThis property list back through
    // insomnia.environment.set — the only channel available — for the assertions below.
    const result = await runScriptInQuickJs({
      script: `
        const hostGlobals = [
          'require', 'process', 'module', 'exports', '__dirname', '__filename',
          'Deno', 'Bun', 'window', 'document', 'fetch', 'XMLHttpRequest', 'WebSocket',
          'Buffer', 'setTimeout', 'setInterval', 'setImmediate', 'WebAssembly',
          'importScripts', 'postMessage',
        ];
        const leaked = hostGlobals.filter(name => typeof globalThis[name] !== 'undefined');
        insomnia.environment.set('leakedHostGlobals', leaked);
        insomnia.environment.set('sandboxGlobalNames', Object.getOwnPropertyNames(globalThis));
      `,
      context,
    });

    const data = result.environment.data as Record<string, unknown>;
    expect(data.leakedHostGlobals).toEqual([]);

    // Baseline: what a bare QuickJS context exposes on globalThis with no bootstrap, derived
    // dynamically so it can't go stale as the vendored QuickJS version changes.
    const QuickJS = await getQuickJSModule();
    const bareVm = QuickJS.newContext();
    let bareGlobalNames: string[];
    try {
      const dumped = bareVm.evalCode('Object.getOwnPropertyNames(globalThis)');
      if (dumped.error) {
        dumped.error.dispose();
        throw new Error("failed to enumerate a bare QuickJS context's globals");
      }
      bareGlobalNames = bareVm.dump(dumped.value) as string[];
      dumped.value.dispose();
    } finally {
      bareVm.dispose();
    }
    const baseline = new Set(bareGlobalNames);

    // Anything else reachable on globalThis fails this assertion instead of shipping silently.
    const ALLOWED_EXTRA_GLOBALS = new Set([
      'console',
      '__envGet',
      '__envSet',
      '__varGet',
      '__varSet',
      '__requestJSON',
      '__task',
      'insomnia',
      '$',
    ]);
    const unexpectedGlobals = (data.sandboxGlobalNames as string[]).filter(
      name => !baseline.has(name) && !ALLOWED_EXTRA_GLOBALS.has(name),
    );
    expect(unexpectedGlobals).toEqual([]);
  });

  it('produces the intended timeout error, not a crash, when a script awaits a promise that never resolves', async () => {
    const context = baseContext();
    context.settings = { timeout: 30 } as any;

    await expect(runScriptInQuickJs({ script: 'await new Promise(() => {});', context })).rejects.toThrow(
      /Executing script timeout: 30/,
    );

    // A later, unrelated run must still complete normally afterward.
    const laterContext = baseContext();
    const laterResult = await runScriptInQuickJs({
      script: `insomnia.environment.set('ranCleanly', true);`,
      context: laterContext,
    });
    expect((laterResult.environment.data as Record<string, unknown>).ranCleanly).toBe(true);
  });
});

// KNOWN BUG (unresolved): a real sendRequest() round trip crashes under the real Electron/Worker
// environment (see quickjs-script-engine.ts's module doc comment and
// packages/insomnia-smoke-test/tests/smoke/quickjs-sendrequest-bridge.test.ts, which reproduces it
// end to end). These unit tests mock `fetch` entirely, so they only cover the bridge's own request
// normalization / response reconstruction / error propagation logic — they pass even though the
// real-environment crash is still open, which is exactly the gap this WIP branch exists to flag.
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

  it('normalizes a bare URL string request with an explicit empty headers array', async () => {
    // Regression: the host handler (network.sendRequestWithoutSideEffects) does not default
    // `headers` itself — omitting it here crashes createConfiguredCurlInstance's
    // `headers.find(...)` user-agent lookup with "Cannot read properties of undefined".
    const fetchMock = stubFetchOnce({
      ok: true,
      body: { code: 200, status: 'OK', headers: [], body: '', responseTime: 1 },
    });
    const context = baseContext();

    await runScriptInQuickJs({ script: `await insomnia.sendRequest('https://example.com');`, context });

    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.options.request).toEqual({ url: 'https://example.com', method: 'GET', headers: [] });
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
