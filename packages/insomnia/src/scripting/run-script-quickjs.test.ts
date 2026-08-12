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
  private messageListeners: ((event: { data: any }) => void)[] = [];
  private errorListeners: ((event: { message: string }) => void)[] = [];

  postMessage(data: any) {
    this.postedMessages.push(data);
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

  beforeEach(async () => {
    fakeWorker = new FakeWorker();
    vi.stubGlobal('Worker', vi.fn(() => fakeWorker));
    // The module keeps a lazily-created singleton worker at module scope — reset it between tests
    // by re-importing fresh so each test gets its own FakeWorker instance.
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts a message and resolves with the worker\'s result for the matching id', async () => {
    const { runScriptInQuickJs } = await import('./run-script-quickjs');
    const context = baseContext();

    const promise = runScriptInQuickJs({ script: 'console.log(1)', context });
    expect(fakeWorker.postedMessages).toHaveLength(1);
    const { id } = fakeWorker.postedMessages[0];
    expect(typeof id).toBe('string');

    const result = { ...context, logs: ['log: 1\n'] };
    fakeWorker.emitMessage({ id, result });

    await expect(promise).resolves.toEqual(result);
  });

  it('rejects with the worker-reported error for the matching id', async () => {
    const { runScriptInQuickJs } = await import('./run-script-quickjs');
    const context = baseContext();

    const promise = runScriptInQuickJs({ script: 'throw new Error("boom")', context });
    const { id } = fakeWorker.postedMessages[0];
    fakeWorker.emitMessage({ id, error: { message: 'boom', name: 'Error' } });

    await expect(promise).rejects.toThrow('boom');
  });

  it('ignores a message whose id does not match any pending request', async () => {
    const { runScriptInQuickJs } = await import('./run-script-quickjs');
    const context = baseContext();

    const promise = runScriptInQuickJs({ script: 'console.log(1)', context });
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
    vi.stubGlobal('Worker', vi.fn(() => secondWorker));

    const secondCall = runScriptInQuickJs({ script: 'console.log(1)', context });
    expect(secondWorker.postedMessages).toHaveLength(1);
    const { id } = secondWorker.postedMessages[0];
    const result = { ...context, logs: [] };
    secondWorker.emitMessage({ id, result });

    await expect(secondCall).resolves.toEqual(result);
  });
});
