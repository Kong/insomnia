// Imports the renderer implementation by default.
// esbuild node builds alias this to read-file-adapter.node via the renderer-to-node plugin.
export { insecureReadFile } from './read-file-adapter.renderer';
