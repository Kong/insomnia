// Runtime adapter selection: renderer uses IPC bridge, node uses libcurl directly.
// Vite production inlines process.type='renderer' so Rollup tree-shakes the node branch.
import type * as AdapterType from './network-adapter.renderer';

 
const impl = (
  (process as any).type === 'renderer' &&
  globalThis.window !== undefined &&
  globalThis.window.main !== undefined &&
  globalThis.window.main.plugins !== undefined
    ? require('./network-adapter.renderer')
    : require(/* @vite-ignore */ './network-adapter.node')
) as typeof AdapterType;

export const {
  getTimelinePath,
  appendToTimelineOnError,
  appendTimelineLines,
  getAuthHeader,
  executeCurlRequest,
  runScript,
  applyRequestHooks,
  applyResponseHooks,
} = impl;
