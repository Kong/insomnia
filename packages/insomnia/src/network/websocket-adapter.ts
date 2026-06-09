// Imports renderer by default; esbuild node builds alias this to websocket-adapter.node
export { open, close, closeAll, readyState, event } from './websocket-adapter.renderer';
