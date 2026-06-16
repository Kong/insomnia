import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TemplateTag } from '../../plugins/types';
import * as extWorker from '../liquid-extension-worker';
import { reload, render } from '../worker';

// Mock only the IPC bridge; keep createLiquidTagWorker (and everything else) real so the
// engine is built and the tag is rendered exactly as it is at runtime.
vi.mock('../liquid-extension-worker', async importOriginal => {
  return { ...(await importOriginal()), fetchFromTemplateWorkerDatabase: vi.fn() };
});

const mockFetch = vi.mocked(extWorker.fetchFromTemplateWorkerDatabase);

const userPluginTag: TemplateTag = {
  plugin: {
    name: 'insomnia-plugin-request-body-hmac',
    description: 'a user-installed plugin',
    version: '1.0.0',
    // user-installed plugins are loaded from disk and have a non-empty directory
    directory: '/Users/me/Library/Application Support/Insomnia/plugins/insomnia-plugin-request-body-hmac',
    config: { disabled: false },
    module: {},
  },
  templateTag: {
    name: 'requestbodyhmac',
    displayName: 'Request Body HMAC',
    description: 'hmac of the request body',
    args: [],
    // overridden by the worker to route execution back over IPC; never called directly
    run: async () => 'unrouted',
  },
};

describe('worker getLiquid plugin tag registration', () => {
  beforeEach(() => {
    reload();
    mockFetch.mockReset();
  });

  it('registers user-installed plugin tags and routes their execution to the main process', async () => {
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

    // Before the fix this threw `tag "requestbodyhmac" not found`, because user-installed
    // plugin tags were collected for the editor but never merged into the render engine.
    const result = await render('{% requestbodyhmac %}');

    expect(result).toBe('ROUTED_RESULT');
    expect(mockFetch).toHaveBeenCalledWith(
      'plugin.executeUserPluginTag',
      expect.objectContaining({
        pluginName: 'insomnia-plugin-request-body-hmac',
        tagName: 'requestbodyhmac',
      }),
    );
  });
});
