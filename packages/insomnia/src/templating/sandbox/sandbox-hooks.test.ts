import { describe, expect, it } from 'vitest';

import { type HostBridge } from './host-bridge';
import { type ContextEnvelope, type HookResult } from './marshal';
import { runTagInSandbox } from './plugin-tag-sandbox';

// H1: request/response hooks run inside the sandbox. The hook mutates context.request in place; the
// sandbox marshals the mutated request back out as JSON so the host can merge it. These tests drive
// the hook path directly with a hand-built envelope.

const noBridge: HostBridge = async path => {
  throw new Error(`unexpected bridge call: ${path}`);
};

const runRequestHook = async (
  hookSource: string,
  request: Record<string, unknown>,
  grantedCapabilities: string[] = [],
): Promise<Record<string, unknown>> => {
  const envelope: ContextEnvelope = {
    args: [],
    context: { BASE_URL: 'https://env.example' },
    meta: {},
    renderPurpose: 'send',
    appInfo: { version: '0.0.0', platform: 'linux', arch: 'x64' },
    pluginName: 'test-plugin',
    renderDepth: 0,
    grantedModules: ['path', 'crypto'],
    grantedCapabilities,
    moduleFiles: { 'index.js': `module.exports.requestHooks = [${hookSource}];` },
    entryModuleKey: 'index.js',
    hookKind: 'request',
    hookIndex: 0,
    hookRequest: request,
  };
  const json = await runTagInSandbox({ tagName: '', envelope, bridge: noBridge });
  return (JSON.parse(json) as HookResult).request ?? {};
};

describe('request hooks in the sandbox (H1)', () => {
  it('marshals header/url/method/body mutations back out to the host', async () => {
    const request = await runRequestHook(
      `function (context) {
        context.request.addHeader('X-Injected', 'from-hook');
        context.request.setHeader('X-Existing', 'updated');
        context.request.setUrl('https://rewritten.example/path');
        context.request.setMethod('POST');
        context.request.setBody({ text: 'new-body' });
      }`,
      {
        _id: 'req_1',
        url: 'https://original.example',
        method: 'GET',
        headers: [{ name: 'X-Existing', value: 'original' }],
        body: {},
      },
    );

    expect(request.url).toBe('https://rewritten.example/path');
    expect(request.method).toBe('POST');
    expect(request.body).toEqual({ text: 'new-body' });
    expect(request.headers).toContainEqual({ name: 'X-Injected', value: 'from-hook' });
    // setHeader updates the existing header in place (case-insensitive match), not a duplicate.
    expect(request.headers).toContainEqual({ name: 'X-Existing', value: 'updated' });
    expect((request.headers as unknown[]).length).toBe(2);
  });

  it('matches headers case-insensitively (parity with misc.filterHeaders)', async () => {
    const request = await runRequestHook(
      `function (context) { context.request.setHeader('content-TYPE', 'application/json'); }`,
      { headers: [{ name: 'Content-Type', value: 'text/plain' }] },
    );
    // Updated in place, not appended, because the lookup is case-insensitive.
    expect(request.headers).toEqual([{ name: 'Content-Type', value: 'application/json' }]);
  });

  it('reads environment variables from the render context', async () => {
    const request = await runRequestHook(
      `function (context) { context.request.setHeader('X-Base', context.request.getEnvironmentVariable('BASE_URL')); }`,
      { headers: [] },
    );
    expect(request.headers).toContainEqual({ name: 'X-Base', value: 'https://env.example' });
  });

  it('denies an ungranted host capability from inside a hook (context.network absent)', async () => {
    // No 'network' capability granted → context.network is undefined (C2), so reaching for it throws
    // at the property access — the hook cannot make network calls it didn't declare.
    await expect(
      runRequestHook(`async function (context) { await context.network.sendRequest({}); }`, { headers: [] }, []),
    ).rejects.toThrow(/sendRequest/i);
  });

  it('runs a response hook: reads response, rewrites the body via the host bridge (base64), request is read-only', async () => {
    const bridgeCalls: { path: string; body: any }[] = [];
    const bridge: HostBridge = async (path, body) => {
      bridgeCalls.push({ path, body });
      if (path === 'response.getBodyBuffer') {
        return 'ORIGINAL';
      }
      if (path === 'response.setBody') {
        return null;
      }
      throw new Error(`unexpected bridge call: ${path}`);
    };
    const envelope: ContextEnvelope = {
      args: [],
      context: {},
      meta: {},
      renderPurpose: 'send',
      appInfo: { version: '0.0.0', platform: 'linux', arch: 'x64' },
      pluginName: 'test-plugin',
      renderDepth: 0,
      grantedModules: ['path', 'crypto'],
      grantedCapabilities: [],
      moduleFiles: {
        'index.js': `module.exports.responseHooks = [async function (context) {
          // read-only request view: mutators are absent, getters work
          if (typeof context.request.setHeader !== 'undefined') { throw new Error('request should be read-only in a response hook'); }
          var status = context.response.getStatusCode();
          var ctype = context.response.getHeader('content-type');
          var original = await context.response.getBody();
          context.response.setBody('rewritten:' + status + ':' + ctype + ':' + original);
        }];`,
      },
      entryModuleKey: 'index.js',
      hookKind: 'response',
      hookIndex: 0,
      hookRequest: { url: 'https://x', method: 'GET', headers: [] },
      hookResponse: {
        parentId: 'req_1',
        statusCode: 201,
        headers: [{ name: 'Content-Type', value: 'text/plain' }],
        bodyPath: '/tmp/body-1',
      },
    };
    const json = await runTagInSandbox({ tagName: '', envelope, bridge });
    const result = JSON.parse(json) as HookResult;

    // getBody read went through the existing models.read bridge path.
    expect(bridgeCalls.some(c => c.path === 'response.getBodyBuffer')).toBe(true);
    // setBody wrote via the new host path, base64-encoded so the bytes survive the JSON bridge.
    const setCall = bridgeCalls.find(c => c.path === 'response.setBody');
    expect(setCall?.body.bodyPath).toBe('/tmp/body-1');
    expect(Buffer.from(setCall!.body.bodyBase64, 'base64').toString('utf8')).toBe('rewritten:201:text/plain:ORIGINAL');
    // bytesContent is updated on the response marshaled back to the host.
    expect((result.response as any)?.bytesContent).toBe('rewritten:201:text/plain:ORIGINAL'.length);
  });

  it('allows a granted capability: context.network is present when the manifest grants network', async () => {
    // With 'network' granted the branch exists; feature-detecting it as an object proves C2 attaches
    // the branch (the actual call would bridge to the host, which the unit test bridge rejects).
    const request = await runRequestHook(
      `function (context) { context.request.setHeader('X-Net', typeof context.network); }`,
      { headers: [] },
      ['network'],
    );
    expect(request.headers).toContainEqual({ name: 'X-Net', value: 'object' });
  });
});
