// Regression coverage for how far an elevated/unsandboxed plugin's real Node process access
// actually reaches: shared JS globals, the module loader, and the settings the sandbox decision
// itself reads. Grouped in one file because none of these three map 1:1 onto a single source module
// (unlike, say, `quickjs-runtime.test.ts` next to `quickjs-runtime.ts`) — each is a property of the
// shared process a plugin runs in, not a unit test of one function.
import fs from 'node:fs';
import Module from 'node:module';
import path from 'node:path';

import { services } from 'insomnia-data';
import { afterEach, describe, expect, it } from 'vitest';

import { resolvePluginExecutionMode } from '~/common/plugins/sandbox-mode';

// `common/render.ts:573-576` (`getRenderedRequestAndContext`) is real host code with exactly this
// shape — `JSON.parse(request.body.text)` / `JSON.stringify(o)` on a GraphQL request body, with no
// defensive copying around the global `JSON`/`Object.prototype` — but driving that function directly
// would require mocking the full render pipeline (ancestors, cookie jar, environment context) for no
// added evidentiary value: the property under test is that a real, unrestricted-Node prototype/global
// patch affects *any* later real `JSON.parse`/`JSON.stringify` call in the same process, which is
// demonstrated directly below against the real globals. This is the accepted, unavoidable consequence
// of granting a plugin full, unrestricted Node process access (identical to running any other real
// Node code in-process) rather than a gap specific to any one surface — kept as a permanent record of
// the mechanism actually working, not just an assertion that it's acceptable.
describe('an elevated/unsandboxed plugin patching shared globals', () => {
  const originalToJSON = (Object.prototype as any).toJSON;
  const originalParse = JSON.parse;

  afterEach(() => {
    if (originalToJSON === undefined) {
      delete (Object.prototype as any).toJSON;
    } else {
      (Object.prototype as any).toJSON = originalToJSON;
    }
    JSON.parse = originalParse;
  });

  it('corrupts an unrelated JSON.stringify call elsewhere in the process via Object.prototype.toJSON', () => {
    const before = JSON.stringify({ query: 'query { viewer { id } }' });
    expect(before).toContain('viewer');

    // Real Node access — no sandbox involved — a plugin's own top-level module code can do this.
    (Object.prototype as any).toJSON = function () {
      return { pwned: true };
    };

    const after = JSON.stringify({ query: 'query { viewer { id } }' });
    expect(after).toBe('{"pwned":true}');
    expect(after).not.toContain('viewer');
  });

  it('can target a specific real JSON.parse call while leaving unrelated ones untouched', () => {
    const CANARY = '__insomnia_graphql_body_canary__';

    JSON.parse = ((text: string, reviver?: any) => {
      if (typeof text === 'string' && text.includes(CANARY)) {
        return { query: 'query { pwned }' };
      }
      return originalParse(text, reviver);
    }) as typeof JSON.parse;

    // Stands in for `common/render.ts:573-576`'s real `JSON.parse(request.body.text)` on a
    // GraphQL-mimetype request body — the same global `JSON.parse` reference that call site uses.
    const graphqlBody = JSON.stringify({ query: `query { viewer { ${CANARY} } }` });
    const parsedGraphqlBody = JSON.parse(graphqlBody);
    expect(parsedGraphqlBody.query).toBe('query { pwned }');

    // An unrelated JSON.parse call elsewhere in the same process is unaffected.
    const unrelated = JSON.parse('{"ok":true}');
    expect(unrelated).toEqual({ ok: true });
  });
});

// How far a `Module.prototype.require` patch actually reaches: it does genuinely intercept
// subsequent real `require()` calls (general mechanism), but the host's own internal dynamic
// imports are esbuild-bundled into one file and never hit the real module loader at all — only
// genuinely `external` packages (and Node builtins) remain real, interceptable `require()` calls.
// The one `external` package this scope does matter for in practice — `quickjs-emscripten` — is
// covered specifically by `../../plugins/__tests__/plugin-load-order-quickjs-module-resolution.
// test.ts` and `../../plugins/__tests__/sandbox-engine-preload-order.test.ts`.
describe('a plugin patching Module.prototype.require', () => {
  const originalRequire = Module.prototype.require;

  afterEach(() => {
    Module.prototype.require = originalRequire;
  });

  it('genuinely intercepts a subsequent real require() call', () => {
    const intercepted: string[] = [];
    (Module.prototype as any).require = function (this: NodeJS.Module, id: string, ...rest: unknown[]) {
      intercepted.push(id);
      return originalRequire.apply(this, [id, ...rest] as any);
    };

    const nodeRequire = require('node:module').createRequire(__filename);
    const result = nodeRequire('node:path');

    expect(intercepted).toContain('node:path');
    expect(result).toBe(path);
  });

  it('does not observe a dynamic ESM import() under this test runner (environment-specific, not a rebuttal)', async () => {
    const intercepted: string[] = [];
    (Module.prototype as any).require = function (this: NodeJS.Module, id: string, ...rest: unknown[]) {
      intercepted.push(id);
      return originalRequire.apply(this, [id, ...rest] as any);
    };

    await import('node:os');

    // Vitest's Vite-SSR module runner routes ESM `import()` through its own loader, bypassing
    // Node's CJS `Module.prototype.require` entirely — this is a property of the test runner, not
    // evidence either way about the packaged app's own dynamic imports (see the bundling check below).
    expect(intercepted).not.toContain('node:os');
  });

  it('cannot reach the host\'s own internal dynamic imports in the shipped bundle — they are esbuild-inlined, not real requires', () => {
    const esbuildConfigPath = path.resolve(__dirname, '../../../esbuild.entrypoints.ts');
    const config = fs.readFileSync(esbuildConfigPath, 'utf8');

    // The main-process build bundles every local project module into one file; only packages in
    // this `external` list remain real, separately-`require()`-able modules at runtime.
    expect(config).toContain("'electron'");
    expect(config).toContain("'quickjs-emscripten'");
    expect(config).toContain("'@getinsomnia/node-libcurl'");
    // A representative internal module the host dynamically imports (e.g. from
    // `runtimes/network/network-adapter.node.ts`) is never listed as external — confirming it gets
    // inlined at build time rather than reaching `Module.prototype.require` at runtime.
    expect(config).not.toMatch(/external:\s*\[[^\]]*templating-worker-database/);
  });
});

// Whether `services.settings.get()` has any in-memory cache a plugin could reach and mutate to fake
// the global sandbox-toggle state for itself or every other plugin — the same shape of risk as
// `../../plugins/__tests__/registry-cross-plugin-reachability.test.ts`'s coverage of
// `plugins/index.ts`'s `plugins` array, applied to the settings the sandbox decision itself reads.
// Kept as a permanent guard: if `services.settings.get()` ever grows such a cache, this file should
// start failing the moment that happens, not go unnoticed until someone finds a way to reach it.
describe('services.settings.get() has no in-memory cache a plugin could poison', () => {
  it('never returns the same object reference across two calls', async () => {
    const first = await services.settings.get();
    const second = await services.settings.get();

    expect(second).not.toBe(first);
  });

  it('has zero effect on a later call when a previously-returned object is mutated directly', async () => {
    const before = await services.settings.get();
    const originalFlag = before.pluginSandboxEnabled;

    // Stands in for an elevated/unsandboxed plugin that somehow got a reference to a previously
    // returned settings object and tried to fake the global toggle for itself or everyone else.
    (before as any).pluginSandboxEnabled = !originalFlag;
    (before as any).templateTagSandboxEnabled = !originalFlag;

    const after = await services.settings.get();

    expect(after.pluginSandboxEnabled).toBe(originalFlag);
    // A caller resolving a plugin's execution mode off the real, freshly-read settings is
    // unaffected by the mutated, previously-returned object.
    expect(resolvePluginExecutionMode(after, { directory: '/plugins/x', config: {} })).toBe(
      resolvePluginExecutionMode({ pluginSandboxEnabled: originalFlag }, { directory: '/plugins/x', config: {} }),
    );
  });
});
