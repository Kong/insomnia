import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TemplateTag } from '~/common/plugins/types';
import * as extWorker from '~/common/templating/liquid-extension-worker';

// `templating.worker.ts` assigns `self.onmessage` at import time, as it does for real inside the
// dedicated Worker thread it runs in. Node has no `self` global, so stand one in before importing.
(globalThis as any).self = globalThis;
const postMessage = vi.fn();
(globalThis as any).self.postMessage = postMessage;

vi.mock('~/common/templating/liquid-extension-worker', async importOriginal => {
  return { ...(await importOriginal()), fetchFromTemplateWorkerDatabase: vi.fn() };
});

// Side-effecting import: assigns `self.onmessage`, exactly as it does inside the real Worker thread.
await import('~/ui/worker/templating.worker');

const mockFetch = vi.mocked(extWorker.fetchFromTemplateWorkerDatabase);

const userPluginTag: TemplateTag = {
  plugin: {
    name: 'insomnia-plugin-request-body-hmac',
    description: 'a user-installed plugin',
    version: '1.0.0',
    directory: '/Users/me/Library/Application Support/Insomnia/plugins/insomnia-plugin-request-body-hmac',
    config: { disabled: false },
    permissions: { modules: [], capabilities: [] },
    permissionWarnings: [],
    permissionsDeclared: false,
    module: {},
  },
  templateTag: {
    name: 'requestbodyhmac',
    displayName: 'Request Body HMAC',
    description: 'hmac of the request body',
    args: [],
    run: async () => 'unrouted',
  },
};

let nextId = 0;
async function sendRenderJob(input: string) {
  const id = `test-id-${nextId++}`;
  await (globalThis as any).self.onmessage({
    data: JSON.stringify({ id, input, context: {}, path: 'test', ignoreUndefinedEnvVariable: false }),
  });
  const call = postMessage.mock.calls.find(([msg]) => msg.id === id);
  return call?.[0];
}

async function sendReload() {
  await (globalThis as any).self.onmessage({ data: JSON.stringify({ type: 'reload' }) });
}

describe('templating.worker reload handling', () => {
  beforeEach(async () => {
    postMessage.mockClear();
    mockFetch.mockReset();
    // Reset the worker's own cached engine directly so each test starts from a clean slate,
    // independent of whatever the reload wiring under test does.
    const workerModule = await import('~/ui/templating/worker');
    workerModule.reload();
  });

  it('picks up a user plugin tag that was missing when the engine was first built, once reloaded', async () => {
    // Simulate the first-ever render of the session racing plugin discovery: the user's plugin
    // tag isn't back yet, so the engine gets built and cached without it.
    mockFetch.mockImplementation(async (path: any) => {
      if (path === 'plugin.getBundlePluginTemplateTags' || path === 'plugin.getUserPluginTemplateTags') {
        return [];
      }
      return;
    });
    const before = await sendRenderJob('{% requestbodyhmac %}');
    expect(before.err).toBeTruthy();

    // Plugin discovery now succeeds, but without a reload the worker's cached engine still
    // doesn't know about it, and the plugin never comes back no matter how many more renders run.
    mockFetch.mockImplementation(async (path: any) => {
      switch (path) {
        case 'plugin.getBundlePluginTemplateTags': {
          return [];
        }
        case 'plugin.getUserPluginTemplateTags': {
          return [userPluginTag];
        }
        case 'plugin.executeUserPluginTag': {
          return 'ROUTED_RESULT';
        }
        default: {
          return;
        }
      }
    });
    const stillMissing = await sendRenderJob('{% requestbodyhmac %}');
    expect(stillMissing.err).toBeTruthy();

    // Reloading (what the Settings > Plugins "Reload" button, and the main-process
    // `reload-plugins` broadcast, are meant to trigger) must invalidate the cached engine so the
    // next render picks the plugin back up.
    await sendReload();
    const afterReload = await sendRenderJob('{% requestbodyhmac %}');
    expect(afterReload.err).toBeFalsy();
    expect(afterReload.result).toBe('ROUTED_RESULT');
  });
});
