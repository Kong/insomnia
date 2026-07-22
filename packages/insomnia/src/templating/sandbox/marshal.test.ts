import { describe, expect, it } from 'vitest';

import { type HostBridge } from './host-bridge';
import { type ContextEnvelope, HOOK_REQUEST_FIELDS, type HookResult, mergeHookRequestMutation, stripDangerousKeysReviver } from './marshal';
import { runTagInSandbox } from './plugin-tag-sandbox';

// H1-HOOK-SANDBOX-SECURITY-REVIEW.md, finding 2: a request hook can plant an own `__proto__`/
// `constructor`/`prototype` key on nested request data (`body`, `authentication`, individual
// header/cookie entries) using computed-key JSON construction, and — before this fix — that key
// survived a plain `JSON.parse` of the sandbox's output intact, landing on the live host request
// object the merge produced. No live downstream sink was found for this at review time, but it's
// exactly the kind of latent primitive a future unrelated change (a deep clone/merge added
// elsewhere) could turn into real `Object.prototype` pollution — so it's neutralized at the
// boundary instead of relying on every future consumer being careful.
//
// This suite is deliberately DYNAMIC rather than one hardcoded case: `DANGEROUS_KEY_SCENARIOS`
// describes *where* a hook can plant a dangerous key, and `findDangerousOwnKeyPaths` searches the
// entire result structure for survivors rather than checking one specific path — so a new
// scenario is one array entry, and a regression anywhere in the structure is caught without
// needing a matching new assertion.

const noBridge: HostBridge = async path => {
  throw new Error(`unexpected bridge call: ${path}`);
};

const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

/** Recursively lists every "$.path.to.key" where an *own* dangerous key was found. */
function findDangerousOwnKeyPaths(value: unknown, path = '$', seen = new Set<unknown>()): string[] {
  if (value === null || typeof value !== 'object') {
    return [];
  }
  if (seen.has(value)) {
    return [];
  }
  seen.add(value);

  const found: string[] = [];
  for (const key of Object.getOwnPropertyNames(value)) {
    const childPath = `${path}.${key}`;
    if (DANGEROUS_KEYS.includes(key)) {
      found.push(childPath);
    }
    found.push(...findDangerousOwnKeyPaths((value as Record<string, unknown>)[key], childPath, seen));
  }
  return found;
}

const runRequestHookRaw = async (
  hookSource: string,
  request: Record<string, unknown>,
): Promise<string> => {
  const envelope: ContextEnvelope = {
    args: [],
    context: {},
    meta: {},
    renderPurpose: 'send',
    appInfo: { version: '0.0.0', platform: 'linux', arch: 'x64' },
    pluginName: 'test-plugin',
    renderDepth: 0,
    grantedModules: [],
    grantedCapabilities: [],
    moduleFiles: { 'index.js': `module.exports.requestHooks = [${hookSource}];` },
    entryModuleKey: 'index.js',
    hookKind: 'request',
    hookIndex: 0,
    hookRequest: request,
  };
  return runTagInSandbox({ tagName: '', envelope, bridge: noBridge });
};

describe('stripDangerousKeysReviver + mergeHookRequestMutation (defense-in-depth on the hook marshal boundary)', () => {
  // Each scenario is a hook body that plants a dangerous key somewhere different in the request
  // it returns, via computed-key JSON construction (the technique that survives a plain
  // JSON.parse as a real own property instead of triggering the `__proto__` accessor).
  const DANGEROUS_KEY_SCENARIOS = DANGEROUS_KEYS.flatMap(key => [
    {
      name: `${key} nested inside a hook-supplied body`,
      hookSource: `function (context) {
        context.request.setBody(JSON.parse('{"${key}":{"polluted":true},"text":"hi"}'));
      }`,
      request: { body: {} },
    },
    {
      name: `${key} nested inside a hook-supplied authentication value`,
      hookSource: `function (context) {
        context.request.setAuthenticationParameter('token', JSON.parse('{"${key}":{"polluted":true}}'));
      }`,
      request: { authentication: {} },
    },
    {
      name: `${key} nested two levels deep inside a hook-supplied body`,
      hookSource: `function (context) {
        context.request.setBody(JSON.parse('{"nested":{"deeper":{"${key}":{"polluted":true}}}}'));
      }`,
      request: { body: {} },
    },
  ]);

  it.each(DANGEROUS_KEY_SCENARIOS)('$name: does not survive the fixed parse into the merged request', async ({ hookSource, request }) => {
    const json = await runRequestHookRaw(hookSource, request);

    // Sanity check the attack actually works against a naive parse — otherwise this test would
    // pass for the wrong reason (the hook failed to plant anything, not because the fix works).
    const naive = JSON.parse(json) as HookResult;
    expect(findDangerousOwnKeyPaths(naive.request)).not.toEqual([]);

    // The fixed parse: a reviver strips the dangerous key at every depth as it's parsed.
    const sanitized = JSON.parse(json, stripDangerousKeysReviver) as HookResult;
    expect(findDangerousOwnKeyPaths(sanitized.request)).toEqual([]);

    // And the fixed merge only copies allowlisted top-level fields onto the live request object
    // the host is building — proving the *actual* code path used by both call sites
    // (`network-adapter.node.ts`, `invoke-method.ts`) ends up clean, not just the parse step.
    const target: Record<string, unknown> = { _id: 'req_1' };
    mergeHookRequestMutation(target, sanitized.request ?? {});
    expect(findDangerousOwnKeyPaths(target)).toEqual([]);
  });

  it('mergeHookRequestMutation only ever copies fields from the HOOK_REQUEST_FIELDS allowlist', () => {
    const target: Record<string, unknown> = {};
    // Parsed from JSON (as the real merge callers' input always is), so a computed-key
    // "__proto__" is a genuine own property here, not the object-literal prototype-setter.
    const mutated = JSON.parse(
      '{"url":"https://rewritten.example","unexpectedNewField":"should not appear","__proto__":{"polluted":true}}',
    ) as Record<string, unknown>;

    mergeHookRequestMutation(target, mutated);

    expect(target.url).toBe('https://rewritten.example');
    expect(target).not.toHaveProperty('unexpectedNewField');
    expect(Object.getOwnPropertyNames(target)).not.toContain('__proto__');
    expect(Object.getOwnPropertyNames(target).every(key => (HOOK_REQUEST_FIELDS as readonly string[]).includes(key))).toBe(true);
  });
});
