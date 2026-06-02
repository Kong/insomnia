// Imports the renderer implementation by default.
// esbuild node builds alias this to vault-adapter.node via the renderer-to-node plugin.
export { encryptSecretValue, decryptSecretValue } from './vault-adapter.renderer';
