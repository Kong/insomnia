import type * as NodeAdapterModule from './network-adapter.node';
import type * as RendererAdapterModule from './network-adapter.renderer';

// Runtime adapter selection: renderer uses IPC bridge, node uses libcurl directly.
// Vite production inlines process.type='renderer' so Rollup tree-shakes the node branch.
type RendererAdapter = typeof RendererAdapterModule;
type NodeAdapter = typeof NodeAdapterModule;
type Assert<T extends true> = T;

type NetworkAdapter = Pick<
  RendererAdapter,
  | 'getTimelinePath'
  | 'appendToTimelineOnError'
  | 'appendTimelineLines'
  | 'getAuthHeader'
  | 'executeCurlRequest'
  | 'runScript'
  | 'applyRequestHooks'
  | 'applyHarRequestHooks'
  | 'applyResponseHooks'
>;

export type _NodeAdapterMatchesNetworkAdapter = Assert<NodeAdapter extends NetworkAdapter ? true : false>;

const impl = (
  (process as any).type === 'renderer'
    ? require('./network-adapter.renderer')
    : require(/* @vite-ignore */ './network-adapter.node')
) as NetworkAdapter;

export const {
  getTimelinePath,
  appendToTimelineOnError,
  appendTimelineLines,
  getAuthHeader,
  executeCurlRequest,
  runScript,
  applyRequestHooks,
  applyHarRequestHooks,
  applyResponseHooks,
} = impl;
