import * as networkAdapter from './network/network-adapter.renderer';
import * as renderAdapter from './templating/render-adapter.renderer';
import * as cryptAdapter from './crypto/crypt-adapter.renderer';
import * as secretStorageAdapter from './secret-storage/secret-storage-adapter.renderer';
import type { RuntimeCapabilities } from './types';

export const rendererRuntime = {
  network: networkAdapter,
  crypto: cryptAdapter,
  templating: renderAdapter,
  secretStorage: secretStorageAdapter,
} satisfies RuntimeCapabilities;
