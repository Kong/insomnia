import { type Context, Liquid, Tag } from 'liquidjs';
import { describe, expect, it } from 'vitest';

import { createLiquidTag } from '../../../templating/liquid-extension';
import { buildLiquidEngine, runExcludedFromRenderLimit } from '../liquid-engine';
import { createLiquidTagWorker } from '../liquid-extension-worker';
import type { PluginTemplateTag } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function buildEngine(wrap: boolean) {
  const engine = new Liquid({ renderLimit: 50 });
  class SlowTag extends Tag {
    async render(ctx: Context, emitter: { write: (s: string) => void }) {
      const wait = () => sleep(150);
      await (wrap ? runExcludedFromRenderLimit(ctx, wait) : wait());
      emitter.write('done');
    }
  }
  engine.registerTag('slow', SlowTag as any);
  return engine;
}

describe('runExcludedFromRenderLimit', () => {
  it('fails when a slow tag is not excluded (control)', async () => {
    await expect(buildEngine(false).parseAndRender('{% slow %}{% slow %}')).rejects.toThrow(/render limit exceeded/);
  });

  it('does not count time spent in a tag against renderLimit', async () => {
    await expect(buildEngine(true).parseAndRender('{% slow %}-{% slow %}-{{ "x" }}')).resolves.toBe('done-done-x');
  });

  it('still enforces renderLimit for time spent outside tags', async () => {
    const engine = buildEngine(true);
    engine.registerFilter('busy', (v: string) => {
      const end = performance.now() + 100;
      while (performance.now() < end) {
        continue;
      }
      return v;
    });
    await expect(engine.parseAndRender('{{ "a" | busy }}{{ "b" }}')).rejects.toThrow(/render limit exceeded/);
  });

  it('extends the deadline even when the tag throws', async () => {
    const engine = new Liquid({ renderLimit: 50 });
    class FailingTag extends Tag {
      async render(ctx: Context, emitter: { write: (s: string) => void }) {
        // Swallow the error so rendering continues; a stale deadline would then fail on the next template.
        await runExcludedFromRenderLimit(ctx, async () => {
          await sleep(150);
          throw new Error('tag failed');
        }).catch(() => emitter.write('caught-'));
      }
    }
    engine.registerTag('fail', FailingTag as any);
    await expect(engine.parseAndRender('{% fail %}{{ "x" }}')).resolves.toBe('caught-x');
  });
});

// The wiring tests: both real tag factories must route ext.run() through the exclusion, otherwise
// removing the wrapper in either place would go unnoticed.
describe.each([
  ['worker', createLiquidTagWorker],
  ['main', createLiquidTag],
])('%s tag factory', (_name, factory) => {
  const plugin = { name: 'test-plugin' } as any;
  const buildWith = (run: PluginTemplateTag['run']) =>
    buildLiquidEngine({
      renderLimitMs: 50,
      tagFactory: (ext, p) => factory(ext, p),
      tags: [{ templateTag: { name: 'slowTag', displayName: 'Slow', description: 'slow', args: [], run } as PluginTemplateTag, plugin }],
    }).engine;

  it('does not count tag run time against the render limit', async () => {
    const engine = buildWith(async () => {
      await sleep(150);
      return 'ok';
    });
    await expect(engine.parseAndRender('{% slowTag %}{% slowTag %}')).resolves.toBe('okok');
  });

  it('still enforces the limit on engine work around slow tags', async () => {
    const engine = buildWith(async () => {
      await sleep(150);
      return 'ok';
    });
    engine.registerFilter('busy', (v: string) => {
      const end = performance.now() + 100;
      while (performance.now() < end) {
        continue;
      }
      return v;
    });
    await expect(engine.parseAndRender('{% slowTag %}{{ "a" | busy }}{{ "b" }}')).rejects.toThrow(
      /render limit exceeded/,
    );
  });
});

describe('buildLiquidEngine limits', () => {
  it('defaults to a 10 s render limit and a 10 MB memory limit', () => {
    const { engine } = buildLiquidEngine({ tagFactory: () => Tag as any, tags: [] });
    expect(engine.options.renderLimit).toBe(10_000);
    expect(engine.options.memoryLimit).toBe(10_000_000);
  });

  it('lets callers override the render limit', () => {
    const { engine } = buildLiquidEngine({ renderLimitMs: 123, tagFactory: () => Tag as any, tags: [] });
    expect(engine.options.renderLimit).toBe(123);
  });
});
