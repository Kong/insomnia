import { describe, expect, it } from 'vitest';

import { ALL_SANDBOX_MODULES } from './module-registry';
import {
  findLeakedGatedReferences,
  findSandboxInternalGlobals,
  findUnaccountedHostNatives,
  formatSurfaceEntries,
  getSandboxEscapeProbe,
  getSandboxSurface,
  SANDBOX_INTERNAL_GLOBALS,
} from './sandbox-surface';

describe('sandbox surface', () => {
  it('matches surface snapshot', async () => {
    const entries = await getSandboxSurface();
    expect(formatSurfaceEntries(entries)).toMatchSnapshot();
  }, 20_000);

  // Always on: fails loudly and names the exact module if a registry entry stops resolving.
  it('all registered modules resolve', async () => {
    const entries = await getSandboxSurface();
    for (const name of ALL_SANDBOX_MODULES) {
      const root = `require(${JSON.stringify(name)})`;
      const rootEntries = entries.filter(e => e.root === root);
      const resolved = rootEntries.some(e => e.type !== 'denied');
      expect(resolved, `expected "${root}" to resolve in the sandbox surface, but found no matching entry`).toBe(true);
      expect(rootEntries.some(e => e.type === 'denied')).toBe(false);
    }
  }, 20_000);
});

describe('sandbox', () => {
  // tag.run.apply(null, args) would leak the host global here in sloppy-mode JS if unguarded.
  it('this resolver', async () => {
    const r = await getSandboxEscapeProbe();
    expect(r.moduleThisIsGlobal).toBe(true);
    expect(r.runThisIsGlobal).toBe(true);
  }, 20_000);

  // The classic same-process vm-sandbox escape technique.
  it('function(..) resolver', async () => {
    const r = await getSandboxEscapeProbe();
    expect(r.viaFunctionCtor.isSandboxGlobal).toBe(true);
    expect(r.viaIndirectCtor.isSandboxGlobal).toBe(true);
  }, 20_000);

  // Node-only identifiers that should never exist as bare globals in a QuickJS realm.
  it('ambient globals resolver', async () => {
    const r = await getSandboxEscapeProbe();
    expect(r.ambientGlobalLeaks).toEqual({
      global: 'undefined',
      require: 'undefined',
      module: 'undefined',
      __dirname: 'undefined',
      __filename: 'undefined',
    });
  }, 20_000);

  // sandbox-globals.ts's process shim must stay a fake, empty shell — never real host data.
  it('process shim resolver', async () => {
    const r = await getSandboxEscapeProbe();
    expect(r.processShim.envKeys).toEqual([]);
    expect(r.processShim.versionsKeys).toEqual([]);
    expect(r.processShim.hasBinding).toBe('undefined');
    expect(r.processShim.hasMainModule).toBe('undefined');
  }, 20_000);

  // Structural fingerprint, not a fixed list — catches any bare host native automatically.
  it('unaccounted host natives resolver', async () => {
    const entries = await getSandboxSurface();
    expect(findUnaccountedHostNatives(entries)).toEqual([]);
  }, 20_000);

  // Reference-identity check: a gated wrapper that's also reachable bare on globalThis isn't gating anything.
  it('no gated reference leaks onto bare globalThis (alias resolver)', async () => {
    const entries = await getSandboxSurface();
    expect(
      findLeakedGatedReferences(entries, [
        // Intentional, not a leak: URL/URLSearchParams are already ungated ambient globals (like
        // atob/Buffer) with zero grant needed, so require('url').URL/.URLSearchParams being ===
        // globalThis.URL/.URLSearchParams matches real Node's own identity and grants nothing beyond
        // what every plugin already has. See the `url` entry in PERMISSIONS.md and URL_FACTORY's
        // comment in module-registry.ts.
        'require("url").URL aliases globalThis.URL',
        'require("url").URLSearchParams aliases globalThis.URLSearchParams',
      ]),
    ).toEqual([]);
  }, 20_000);

  // Completeness tripwire: any new sandbox-internal global must be added here deliberately, so its
  // safety story (who can reach it, what it can do during discovery) gets reviewed rather than
  // slipping in unnoticed.
  it('exposes exactly the reviewed set of sandbox-internal globals', async () => {
    const entries = await getSandboxSurface();
    expect(findSandboxInternalGlobals(entries)).toEqual([...SANDBOX_INTERNAL_GLOBALS].sort());
  }, 20_000);
});
