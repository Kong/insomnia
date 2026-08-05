// `getQuickJSModule()`'s module-scope `modulePromise` (see this file's sibling `quickjs-runtime.ts`)
// is the other half of the security property `plugins/index.ts`'s
// `ensureSandboxEngineLoadedBeforePlugins()` depends on: a value captured once can never be
// silently swapped out by a later call, because there is no later real `require()` — every
// subsequent call reuses the exact same promise. This test drives the real function directly (no
// mocking — the interception mechanism and the load-order guarantee are both covered elsewhere:
// `../../plugins/__tests__/plugin-load-order-quickjs-module-resolution.test.ts`,
// `elevated-plugin-process-access-scope.test.ts`, and
// `../../plugins/__tests__/sandbox-engine-preload-order.test.ts`).
import { describe, expect, it } from 'vitest';

import { getQuickJSModule } from './quickjs-runtime';

describe('getQuickJSModule', () => {
  it('memoizes: repeated calls resolve to the exact same module reference, never a fresh one', async () => {
    const first = await getQuickJSModule();
    const second = await getQuickJSModule();

    // Same promise object — `modulePromise` is set once and reused, not recreated per call.
    expect(getQuickJSModule()).toBe(getQuickJSModule());
    // Same resolved module reference across awaits, too.
    expect(second).toBe(first);
    // Sanity: what's memoized is a genuine, usable QuickJS module, not a stub.
    expect(typeof first.newContext).toBe('function');
  });
});
