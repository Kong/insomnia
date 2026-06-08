// Imports the renderer implementation by default.
// esbuild node builds alias this to network-adapter.node via the renderer-to-node plugin.
export {
  getTimelinePath,
  appendToTimelineOnError,
  appendTimelineLines,
  getAuthHeader,
  executeCurlRequest,
  extractCookies,
  runScript,
  applyRequestHooks,
  applyResponseHooks,
} from './network-adapter.renderer';
