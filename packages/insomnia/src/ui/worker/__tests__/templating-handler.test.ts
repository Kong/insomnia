import { describe, expect, it, vi } from 'vitest';

import type { SensitiveValueCollector } from '~/common/templating/types';

// `templating-handler.ts` spins up a real Worker and reads the templating auth token from
// `window.main` at import time, neither of which exists under Node. Stand both in before importing.
const postedPayloads: string[] = [];
const messageListeners = new Set<(event: any) => void>();

class FakeWorker {
  addEventListener(type: string, listener: (event: any) => void) {
    if (type === 'message') {
      messageListeners.add(listener);
    }
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    if (type === 'message') {
      messageListeners.delete(listener);
    }
  }

  postMessage(payload: string) {
    postedPayloads.push(payload);
  }
}

(globalThis as any).Worker = FakeWorker;
(globalThis as any).window = globalThis;
(globalThis as any).window.main = { templatingDb: { getAuthToken: async () => 'auth-token' } };

const { renderInWorker } = await import('~/ui/worker/templating-handler');

// Deliver a message to every handler currently listening, as the real Worker would. Snapshotted
// first because a handler removes itself once it sees its own render result.
function emitFromWorker(data: any) {
  const listening = [...messageListeners];
  for (const listener of listening) {
    listener({ data });
  }
}

// The renderer half of the worker-to-main `sensitiveValue` bridge. Nothing else in the render path
// would notice it breaking: the render still resolves, the secret just never reaches the collector
// and lands unredacted on disk.
describe('renderInWorker sensitive value bridge', () => {
  it('registers a sensitiveValue message into the collector and still resolves the render', async () => {
    const collector: SensitiveValueCollector = { register: vi.fn(), redact: vi.fn(), isEmpty: true };
    const promise = renderInWorker({
      input: '{% vault %}',
      context: {},
      path: 'test',
      ignoreUndefinedEnvVariable: false,
      sensitiveValueCollector: collector,
    } as any);

    // `renderInWorker` awaits the auth token before it posts, so the payload only shows up a few
    // microtasks in.
    await vi.waitFor(() => expect(postedPayloads).toHaveLength(1));
    const payload = JSON.parse(postedPayloads[0]);
    // The id the worker correlates its sensitiveValue messages with has to reach the worker's
    // render context, not just the message envelope.
    expect(payload.context.serializedFunctions.renderId).toBe(payload.id);

    emitFromWorker({ id: payload.id, type: 'sensitiveValue', value: 'super-secret-value' });
    expect(collector.register).toHaveBeenCalledWith('super-secret-value');

    // A sensitiveValue message must not be mistaken for the render result.
    emitFromWorker({ id: payload.id, result: 'rendered' });
    await expect(promise).resolves.toBe('rendered');
  });
});
