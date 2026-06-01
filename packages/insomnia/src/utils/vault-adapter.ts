// Runtime adapter selection: renderer delegates to IPC, node/CLI uses direct crypto.
// Vite inlines process.type at build time so Rollup tree-shakes the unused branch from each bundle.
import type * as AdapterType from './vault-adapter.node';

const impl = (
  (process as any).type === 'renderer' ? require('./vault-adapter.renderer') : require('./vault-adapter.node')
) as typeof AdapterType;

export const { encryptSecretValue, decryptSecretValue } = impl;
