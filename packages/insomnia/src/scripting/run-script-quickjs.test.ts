import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RequestContext } from '../../../insomnia-scripting-environment/src/objects/interfaces';

const baseContext = (): RequestContext => ({
  request: { _id: 'req_1', name: 'Test request', url: 'https://example.com' } as any,
  timelinePath: '',
  environment: { id: 'env_1', name: 'Base Environment', data: {} },
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

/**
 * A minimal stand-in for the DOM `Worker` API, driven manually from the test — this suite verifies
 * the message-correlation contract between `run-script-quickjs.ts` and `quickjs-script.worker.ts`
 * without needing a real Worker runtime (not available in the Vitest/Node test environment).
 */
class FakeWorker {
  postedMessages: any[] = [];
  terminated = false;
  private messageListeners: ((event: { data: any }) => void)[] = [];
  private errorListeners: ((event: { message: string }) => void)[] = [];

  postMessage(data: any) {
    this.postedMessages.push(data);
  }

  terminate() {
    this.terminated = true;
  }

  addEventListener(type: string, listener: any) {
    if (type === 'message') {
      this.messageListeners.push(listener);
    } else if (type === 'error') {
      this.errorListeners.push(listener);
    }
  }

  removeEventListener() {
    // not used by the client today
  }

  emitMessage(data: any) {
    this.messageListeners.forEach(listener => listener({ data }));
  }

  emitError(message: string) {
    this.errorListeners.forEach(listener => listener({ message }));
  }
}

describe('runScriptInQuickJs (worker client)', () => {
  let fakeWorker: FakeWorker;

  /**
   * The client fetches the templating-db auth token over IPC before posting, so the postMessage
   * lands a microtask later than the call. Awaiting this lets a test assert on `postedMessages`.
   */
  const flushTokenFetch = () => new Promise(resolve => setTimeout(resolve, 0));

  beforeEach(async () => {
    fakeWorker = new FakeWorker();
    vi.stubGlobal(
      'Worker',
      vi.fn(() => fakeWorker),
    );
    // A Worker can't reach `window.main`, so the client fetches the bridge auth token here and
    // forwards it in every message — see `getTemplatingDbAuthToken`.
    vi.stubGlobal('window', {
      main: { templatingDb: { getAuthToken: vi.fn().mockResolvedValue('test-auth-token') } },
    });
    // The module keeps a lazily-created singleton worker at module scope — reset it between tests
    // by re-importing fresh so each test gets its own FakeWorker instance.
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts a message and resolves with the worker's result for the matching id", async () => {
    const { runScriptInQuickJs } = await import('./run-script-quickjs');
    const context = baseContext();

    const promise = runScriptInQuickJs({ script: 'console.log(1)', context });
    await flushTokenFetch();
    expect(fakeWorker.postedMessages).toHaveLength(1);
    const { id, authToken } = fakeWorker.postedMessages[0];
    expect(typeof id).toBe('string');
    // Forwarded so the engine's sendRequest bridge can authenticate against the templating-db
    // protocol; without it every bridge fetch comes back 401.
    expect(authToken).toBe('test-auth-token');

    const result = { ...context, logs: ['log: 1\n'] };
    fakeWorker.emitMessage({ id, result });

    await expect(promise).resolves.toEqual(result);
  });

  it('rejects with the worker-reported error for the matching id', async () => {
    const { runScriptInQuickJs } = await import('./run-script-quickjs');
    const context = baseContext();

    const promise = runScriptInQuickJs({ script: 'throw new Error("boom")', context });
    await flushTokenFetch();
    const { id } = fakeWorker.postedMessages[0];
    fakeWorker.emitMessage({ id, error: { message: 'boom', name: 'Error' } });

    await expect(promise).rejects.toThrow('boom');
  });

  it('ignores a message whose id does not match any pending request', async () => {
    const { runScriptInQuickJs } = await import('./run-script-quickjs');
    const context = baseContext();

    const promise = runScriptInQuickJs({ script: 'console.log(1)', context });
    await flushTokenFetch();
    fakeWorker.emitMessage({ id: 'not-a-real-id', result: {} });

    const { id } = fakeWorker.postedMessages[0];
    const result = { ...context, logs: [] };
    fakeWorker.emitMessage({ id, result });

    await expect(promise).resolves.toEqual(result);
  });

  it('rejects every in-flight call when the worker crashes', async () => {
    const { runScriptInQuickJs } = await import('./run-script-quickjs');
    const context = baseContext();

    const promise = runScriptInQuickJs({ script: 'while(true){}', context });
    fakeWorker.emitError('script execution context has been aborted');

    await expect(promise).rejects.toThrow(/QuickJS sandbox worker crashed/);
  });

  it('creates a fresh worker for the next call after a crash', async () => {
    const { runScriptInQuickJs } = await import('./run-script-quickjs');
    const context = baseContext();

    const firstCall = runScriptInQuickJs({ script: 'while(true){}', context });
    fakeWorker.emitError('boom');
    await expect(firstCall).rejects.toThrow();

    const secondWorker = new FakeWorker();
    vi.stubGlobal(
      'Worker',
      vi.fn(() => secondWorker),
    );

    const secondCall = runScriptInQuickJs({ script: 'console.log(1)', context });
    await flushTokenFetch();
    expect(secondWorker.postedMessages).toHaveLength(1);
    const { id } = secondWorker.postedMessages[0];
    const result = { ...context, logs: [] };
    secondWorker.emitMessage({ id, result });

    await expect(secondCall).resolves.toEqual(result);
  });

  // The engine reports `engineFaulted` when tearing a context down aborted the WASM module (upstream
  // quickjs-emscripten#269). The run itself is complete and must still resolve; the worker caching
  // that module has to go.
  describe('engine fault handling', () => {
    it('still resolves the run, then retires the worker', async () => {
      const { runScriptInQuickJs } = await import('./run-script-quickjs');
      const context = baseContext();

      const promise = runScriptInQuickJs({ script: 'await big()', context });
      await flushTokenFetch();
      const { id } = fakeWorker.postedMessages[0];
      const result = { ...context, logs: ['warn: QuickJS engine faulted…\n'] };
      fakeWorker.emitMessage({ id, result, engineFaulted: true });

      await expect(promise).resolves.toEqual(result);
      expect(fakeWorker.terminated).toBe(true);

      // The next call must not reuse the faulted worker.
      const nextWorker = new FakeWorker();
      vi.stubGlobal(
        'Worker',
        vi.fn(() => nextWorker),
      );
      const nextCall = runScriptInQuickJs({ script: 'console.log(1)', context });
      await flushTokenFetch();
      expect(nextWorker.postedMessages).toHaveLength(1);
      const next = { ...context, logs: [] };
      nextWorker.emitMessage({ id: nextWorker.postedMessages[0].id, result: next });
      await expect(nextCall).resolves.toEqual(next);
    });

    it('waits for a concurrent run to finish before terminating the faulted worker', async () => {
      const { runScriptInQuickJs } = await import('./run-script-quickjs');
      const context = baseContext();

      // Two scripts in flight on the same worker — `self.onmessage` does not serialize.
      const first = runScriptInQuickJs({ script: 'await big()', context });
      const second = runScriptInQuickJs({ script: 'console.log(2)', context });
      await flushTokenFetch();
      expect(fakeWorker.postedMessages).toHaveLength(2);
      const [firstMsg, secondMsg] = fakeWorker.postedMessages;

      const firstResult = { ...context, logs: [] };
      fakeWorker.emitMessage({ id: firstMsg.id, result: firstResult, engineFaulted: true });
      await expect(first).resolves.toEqual(firstResult);

      // Terminating now would strand `second`, so the worker stays alive until it drains.
      expect(fakeWorker.terminated).toBe(false);

      const secondResult = { ...context, logs: ['log: 2\n'] };
      fakeWorker.emitMessage({ id: secondMsg.id, result: secondResult });
      await expect(second).resolves.toEqual(secondResult);
      expect(fakeWorker.terminated).toBe(true);
    });
  });
});
