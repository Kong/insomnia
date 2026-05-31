// Runtime adapter selection: renderer delegates to the templating worker, node/CLI uses the node implementation.
// Vite inlines process.type='renderer' in renderer builds so Rollup can tree-shake the node branch.
import type * as AdapterType from './render-adapter.renderer';

const impl = (
  process.type === 'renderer'
    ? require('./render-adapter.renderer.ts')
    : require('./render-adapter.node.ts')
) as typeof AdapterType;

export const { renderTemplate } = impl;
