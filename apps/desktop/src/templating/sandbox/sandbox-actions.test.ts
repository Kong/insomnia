import { describe, expect, it } from 'vitest';

import { type HostBridge } from './host-bridge';
import { type ContextEnvelope } from './marshal';
import { runTagInSandbox } from './plugin-tag-sandbox';

// A1: plugin actions run inside the sandbox. An action is fire-and-effect — it reads the copied-in
// domain models and performs side effects only through the capability-gated context.* bridge; nothing
// is marshaled back. These tests drive the action path directly with a hand-built envelope.

const runAction = async (
  actionSource: string,
  opts: {
    kind: NonNullable<ContextEnvelope['actionKind']>;
    label: string;
    domainData?: unknown;
    grantedCapabilities?: string[];
  },
): Promise<{ path: string; body: any }[]> => {
  const calls: { path: string; body: any }[] = [];
  const bridge: HostBridge = async (path, body) => {
    calls.push({ path, body });
    if (path === 'pluginData.setItem') {
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
    grantedCapabilities: opts.grantedCapabilities ?? [],
    moduleFiles: { 'index.js': `module.exports.${opts.kind}Actions = [${actionSource}];` },
    entryModuleKey: 'index.js',
    actionKind: opts.kind,
    actionLabel: opts.label,
    actionDomainData: opts.domainData,
  };
  await runTagInSandbox({ tagName: '', envelope, bridge });
  return calls;
};

describe('plugin actions in the sandbox (A1)', () => {
  it('runs the action matching the label, passing domain models, with side effects via a granted capability', async () => {
    const calls = await runAction(
      `{ label: 'Wrong', action: function () { throw new Error('should not run'); } },
       { label: 'Store It', action: async function (context, models) {
         await context.store.setItem('acted-on', models.request._id);
       } }`,
      { kind: 'request', label: 'Store It', domainData: { request: { _id: 'req_42' } }, grantedCapabilities: ['storage'] },
    );
    const setItem = calls.find(c => c.path === 'pluginData.setItem');
    expect(setItem).toBeTruthy();
    expect(setItem!.body).toMatchObject({ key: 'acted-on', value: 'req_42' });
  });

  it('denies an ungranted capability (context.network absent when not granted)', async () => {
    await expect(
      runAction(`{ label: 'Net', action: async function (context) { await context.network.sendRequest({}); } }`, {
        kind: 'request',
        label: 'Net',
        grantedCapabilities: [],
      }),
    ).rejects.toThrow(/sendRequest/i);
  });

  it('throws a clear error when no action matches the label', async () => {
    await expect(
      runAction(`{ label: 'Exists', action: function () {} }`, { kind: 'request', label: 'Missing' }),
    ).rejects.toThrow(/action not found: Missing/i);
  });

  it('resolves the kind-specific list (documentActions) independently', async () => {
    const calls = await runAction(
      `{ label: 'Doc', action: async function (context, spec) { await context.store.setItem('doc', spec.name); } }`,
      { kind: 'document', label: 'Doc', domainData: { name: 'my-spec' }, grantedCapabilities: ['storage'] },
    );
    expect(calls.find(c => c.path === 'pluginData.setItem')!.body).toMatchObject({ key: 'doc', value: 'my-spec' });
  });
});
