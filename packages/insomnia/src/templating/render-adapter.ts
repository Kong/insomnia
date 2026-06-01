// Runtime adapter selection: renderer delegates to the templating worker, node/CLI uses the node implementation.
// Vite inlines process.type at build time so Rollup tree-shakes the unused branch from each bundle.
// process.type is 'renderer' in Electron renderer builds and undefined in Node.js/inso — no cast needed at runtime.
import type * as AdapterType from './render-adapter.node';

const impl = (
  (process as any).type === 'renderer' ? require('./render-adapter.renderer') : require('./render-adapter.node')
) as typeof AdapterType;

export const { renderTemplate } = impl;
