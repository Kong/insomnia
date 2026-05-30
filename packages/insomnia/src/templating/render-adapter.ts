// Runtime adapter: renderer process delegates to the Web Worker; main/node uses the full engine directly.
// Vite inlines process.type='renderer' in the renderer build so Rollup tree-shakes the node branch,
// preventing liquid-extension.ts (node:crypto, node:os) from entering the renderer bundle.
import type * as AdapterType from './render-adapter.renderer';

const impl = (
  (process as any).type === 'renderer'
    ? require('./render-adapter.renderer')
    : require(/* @vite-ignore */ './render-adapter.node')
) as typeof AdapterType;

export const { renderTemplate } = impl;
