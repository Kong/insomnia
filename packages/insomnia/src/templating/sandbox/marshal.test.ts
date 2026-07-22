import { describe, expect, it } from 'vitest';

import { type HostBridge } from './host-bridge';
import { type ContextEnvelope, HOOK_REQUEST_FIELDS, type HookResult, mergeHookRequestMutation, stripDangerousKeysReviver } from './marshal';
import { runTagInSandbox } from './plugin-tag-sandbox';

// H1-HOOK-SANDBOX-SECURITY-REVIEW.md, finding 2: a request hook could plant an own
// `__proto__`/`constructor`/`prototype` key on nested request data via computed-key JSON
// construction, and it survived a plain `JSON.parse` of the sandbox's output intact.
// `DANGEROUS_KEY_SCENARIOS` covers where a hook can plant such a key, and
// `findDangerousOwnKeyPaths` searches the entire result for survivors, so a new scenario is
// one array entry rather than a bespoke assertion.

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

  // Confirms the naive parse is actually vulnerable, then that the reviver and allowlisted merge both end up clean.
  it.each(DANGEROUS_KEY_SCENARIOS)('$name: does not survive the fixed parse into the merged request', async ({ hookSource, request }) => {
    const json = await runRequestHookRaw(hookSource, request);

    const naive = JSON.parse(json) as HookResult;
    expect(findDangerousOwnKeyPaths(naive.request)).not.toEqual([]);

    const sanitized = JSON.parse(json, stripDangerousKeysReviver) as HookResult;
    expect(findDangerousOwnKeyPaths(sanitized.request)).toEqual([]);

    const target: Record<string, unknown> = { _id: 'req_1' };
    mergeHookRequestMutation(target, sanitized.request ?? {});
    expect(findDangerousOwnKeyPaths(target)).toEqual([]);
  });

  // Parsed from JSON, so the computed-key "__proto__" here is a genuine own property, not the object-literal prototype setter.
  it('mergeHookRequestMutation only ever copies fields from the HOOK_REQUEST_FIELDS allowlist', () => {
    const target: Record<string, unknown> = {};
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
