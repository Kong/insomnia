import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildLiquidEngine } from '../liquid-engine';
import { createLiquidTagWorker } from '../liquid-extension-worker';
import { localTemplateTags } from '../local-template-tags';

// Regression for Kong/insomnia#10373: a template mixing prompts, "Response -> Body Attribute" tags
// (which resend their dependency request) and a Faker tag failed with "template render limit
// exceeded" because the time spent waiting on the user and the network counted as render time.
const BRIDGE_DELAY_MS = 150;
const RENDER_LIMIT_MS = 100;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const bridgeResponses: Record<string, (body: any) => Promise<unknown> | unknown> = {
  'pluginData.getItem': () => null,
  'pluginData.setItem': () => ({}),
  // Stands in for the user typing a value into the prompt dialog.
  'app.prompt': async ({ title }) => {
    await sleep(BRIDGE_DELAY_MS);
    return `value-for-${title}`;
  },
  'request.getById': ({ id }) => ({ _id: id }),
  'response.getLatestForRequestId': () => ({ statusCode: 200, headers: [], contentType: 'application/json' }),
  // Stands in for the dependency request going over the network.
  'network.sendRequest': async () => {
    await sleep(BRIDGE_DELAY_MS);
    return { statusCode: 200, headers: [], contentType: 'application/json' };
  },
  'response.getBodyBuffer': () => ({}),
  decode: () => '{"token":"abc"}',
};

const stubBridge = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: { body: string }) => {
      const path = url.replace('insomnia-templating-worker-database://', '');
      const handler = bridgeResponses[path];
      if (!handler) {
        throw new Error(`unexpected bridge call: ${path}`);
      }
      const result = await handler(JSON.parse(init.body));
      return { ok: true, json: async () => result };
    }),
  );

const renderContext = {
  getMeta: () => ({ requestId: 'req_main' }),
  getPurpose: () => 'send',
  getExtraInfo: () => {},
  getEnvironmentId: () => null,
  getGlobalEnvironmentId: () => null,
  getSettings: () => ({}),
};

const buildEngine = (renderLimitMs: number) =>
  buildLiquidEngine({
    renderLimitMs,
    tagFactory: (ext, plugin) => createLiquidTagWorker(ext, plugin),
    tags: localTemplateTags.map(({ templateTag, plugin }) => ({ templateTag, plugin })),
  }).engine;

// '$.token' as a base64-encoded tag argument
const TOKEN_FILTER = 'b64::JC50b2tlbg==::46b';

describe('render limit with real local template tags (#10373)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders 2 prompts, 2 response body attributes and a faker tag past the render limit', async () => {
    stubBridge();
    const template = [
      '{',
      `"a": "{% prompt 'First', 'label', '', 'key-1', false, false %}",`,
      `"b": "{% prompt 'Second', 'label', '', 'key-2', false, false %}",`,
      `"c": "{% response 'body', 'req_1', '${TOKEN_FILTER}', 'always', 60 %}",`,
      `"d": "{% response 'body', 'req_2', '${TOKEN_FILTER}', 'always', 60 %}",`,
      `"e": "{% faker 'isoTimestamp' %}"`,
      '}',
    ].join('\n');

    const start = performance.now();
    const output = await buildEngine(RENDER_LIMIT_MS).parseAndRender(template, renderContext);

    // Four slow bridge calls ran, well past the limit, and rendering still succeeded.
    expect(performance.now() - start).toBeGreaterThan(RENDER_LIMIT_MS * 4);
    const parsed = JSON.parse(output);
    expect(parsed).toMatchObject({ a: 'value-for-First', b: 'value-for-Second', c: 'abc', d: 'abc' });
    expect(Number.isNaN(Date.parse(parsed.e))).toBe(false);
  });
});
