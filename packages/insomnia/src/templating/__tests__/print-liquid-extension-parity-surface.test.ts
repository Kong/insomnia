import { it } from 'vitest';

import type { Plugin } from '~/common/plugins/types';
import { buildLiquidEngine } from '~/common/templating/liquid-engine';
import type { PluginTemplateTag, PluginTemplateTagContext } from '~/common/templating/types';

import { createLiquidTag } from '../liquid-extension';
import { describeLiquidParitySurface } from '../liquid-extension-parity-surface';

const fakePlugin = { name: 'print-parity-surface-test-plugin', directory: '' } as unknown as Plugin;

// Not a regression check — prints the liquid-extension.ts parity surface for eyeballing. Run via
// `npm run sandbox:liquid-parity`.
it('prints the liquid-extension.ts models parity surface', async () => {
  let captured: Record<string, any> | undefined;
  const captureTag: PluginTemplateTag = {
    name: 'capture_models',
    displayName: 'capture_models',
    description: 'test-only: captures util.models for inspection',
    args: [],
    run: (context: PluginTemplateTagContext) => {
      captured = context.util.models;
      return '';
    },
  };
  const { engine } = buildLiquidEngine({
    tagFactory: (ext, plugin) => createLiquidTag(ext, plugin),
    tags: [{ templateTag: captureTag, plugin: fakePlugin }],
  });
  await engine.parseAndRender('{% capture_models %}', {});
  if (!captured) {
    throw new Error('capture_models tag never ran — util.models was not captured');
  }
  const entries = describeLiquidParitySurface(captured);
  const lines = entries.map(e => `${e.key}: ${e.protected ? 'protected' : 'MISSING protection'}`);
  console.log(lines.join('\n'));
  console.log(`\n${lines.length} tracked keys`);
});
