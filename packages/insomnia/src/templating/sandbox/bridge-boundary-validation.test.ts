import { describe, expect, it, vi } from 'vitest';

import { capUtilRenderDepth, createMapBridge } from './host-bridge';
import { type ContextEnvelope, sanitizeErrorMessage } from './marshal';
import { runTagInSandbox } from './plugin-tag-sandbox';

const envelope = (args: unknown[], overrides: Partial<ContextEnvelope> = {}): ContextEnvelope => ({
  args,
  context: {},
  meta: {},
  renderPurpose: 'preview',
  appInfo: { version: '0.0.0', platform: 'linux' },
  pluginName: 'test-plugin',
  renderDepth: 0,
  ...overrides,
});

// ---- Fix 1: util.render depth cap (capUtilRenderDepth) ----
describe('capUtilRenderDepth', () => {
  it('delegates when depth is within the cap', async () => {
    const render = vi.fn(async () => 'rendered');
    const capped = capUtilRenderDepth({ 'util.render': render }, 3);
    await expect(capped['util.render']({ str: 'x', depth: 3 })).resolves.toBe('rendered');
    expect(render).toHaveBeenCalledOnce();
  });

  it('rejects once depth exceeds the cap', async () => {
    const render = vi.fn(async () => 'rendered');
    const capped = capUtilRenderDepth({ 'util.render': render }, 3);
    await expect(capped['util.render']({ str: 'x', depth: 4 })).rejects.toThrow(/maximum nesting depth of 3/);
    expect(render).not.toHaveBeenCalled();
  });

  it('end-to-end: a tag whose util.render exceeds the cap fails', async () => {
    const render = vi.fn(async () => 'rendered');
    // maxDepth 2; the in-sandbox context sends depth = renderDepth + 1 = 6 → over the cap.
    const bridge = createMapBridge(capUtilRenderDepth({ 'util.render': render }, 2));
    const source = 'module.exports.templateTags = [{ name: "r", run: function (c) { return c.util.render("hi"); } }];';
    await expect(
      runTagInSandbox({ pluginSource: source, tagName: 'r', envelope: envelope([], { renderDepth: 5 }), bridge }),
    ).rejects.toThrow(/maximum nesting depth of 2/);
    expect(render).not.toHaveBeenCalled();
  });
});

// ---- Fix 2: error-message sanitization ----
describe('sanitizeErrorMessage', () => {
  it('redacts POSIX absolute paths', () => {
    expect(sanitizeErrorMessage("ENOENT: no such file, open '/Users/secret/.ssh/id_rsa'"))
      .toBe("ENOENT: no such file, open '<redacted-path>'");
  });

  it('redacts Windows absolute paths', () => {
    expect(sanitizeErrorMessage('cannot read C:\\Users\\secret\\notes.txt now'))
      .toBe('cannot read <redacted-path> now');
  });

  it('leaves URLs and plain messages intact', () => {
    expect(sanitizeErrorMessage('request to https://api.example.com/v1/users failed'))
      .toBe('request to https://api.example.com/v1/users failed');
    expect(sanitizeErrorMessage('bridge exploded')).toBe('bridge exploded');
  });

  it('end-to-end: a host error path does not leak into the sandbox', async () => {
    const bridge = createMapBridge({
      nodeOS: async () => {
        throw new Error("ENOENT: open '/Users/victim/secrets.json'");
      },
    });
    const source = 'module.exports.templateTags = [{ name: "o", run: async function (c) { return await c.util.nodeOS(); } }];';
    await expect(
      runTagInSandbox({ pluginSource: source, tagName: 'o', envelope: envelope([]), bridge }),
    ).rejects.toThrow(/<redacted-path>/);
  });
});

// ---- Fix 3: prototype-pollution guard at the JSON.parse boundary ----
describe('prototype-pollution guard', () => {
  it('strips __proto__ from the bridge body before it reaches a handler', async () => {
    const received = vi.fn(async (_body: { request: Record<string, unknown> }) => null);
    const bridge = createMapBridge({ 'network.sendRequest': received });
    // JSON.parse inside the sandbox creates a real own "__proto__" key, which JSON.stringify then
    // serialises into the bridge body — the exact shape the host reviver must neutralise.
    const source = `module.exports.templateTags = [{
      name: 'p',
      run: function (c) {
        var evil = JSON.parse('{"__proto__":{"polluted":"yes"},"url":"http://x"}');
        return c.network.sendRequest(evil).then(function () { return 'ok'; });
      }
    }];`;
    const out = await runTagInSandbox({ pluginSource: source, tagName: 'p', envelope: envelope([]), bridge });

    expect(out).toBe('ok');
    expect(received).toHaveBeenCalledOnce();
    const body = received.mock.calls[0][0];
    expect(body.request).toEqual({ url: 'http://x' });
    // Neither the received object nor the host Object.prototype was polluted.
    expect(Object.getPrototypeOf(body.request)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

// ---- Fix 4: payload size caps ----
describe('payload size caps', () => {
  it('rejects an oversized request payload', async () => {
    const render = vi.fn(async () => 'rendered');
    const bridge = createMapBridge({ 'util.render': render });
    const source = `module.exports.templateTags = [{
      name: 'big',
      run: function (c) { var s = 'x'.repeat(499); return c.util.render(s); }
    }];`;
    await expect(
      runTagInSandbox({ pluginSource: source, tagName: 'big', envelope: envelope([]), bridge, maxPayloadBytes: 50 }),
    ).rejects.toThrow(/request payload too large/);
    expect(render).not.toHaveBeenCalled();
  });

  it('rejects an oversized response payload', async () => {
    const bridge = createMapBridge({ nodeOS: async () => ({ blob: 'y'.repeat(499) }) });
    const source = 'module.exports.templateTags = [{ name: "o", run: async function (c) { return await c.util.nodeOS(); } }];';
    await expect(
      runTagInSandbox({ pluginSource: source, tagName: 'o', envelope: envelope([]), bridge, maxPayloadBytes: 50 }),
    ).rejects.toThrow(/response payload too large/);
  });
});
