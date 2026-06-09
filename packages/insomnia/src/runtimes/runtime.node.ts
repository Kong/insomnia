import * as cryptAdapter from './crypto/crypto-adapter.node';
import * as networkAdapter from './network/network-adapter.node';
import * as secretStorageAdapter from './secret-storage/secret-storage-adapter.node';
import * as renderAdapter from './templating/templating-adapter.node';
import type { RuntimeCapabilities } from './types';

export const nodeRuntime = {
  network: networkAdapter,
  crypto: cryptAdapter,
  templating: renderAdapter,
  secretStorage: secretStorageAdapter,
} satisfies RuntimeCapabilities;
