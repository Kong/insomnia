import * as cryptAdapter from './crypto/crypto-adapter.renderer';
import * as importAdapter from './import/import-adapter.renderer';
import * as networkAdapter from './network/network-adapter.renderer';
import * as secretStorageAdapter from './secret-storage/secret-storage-adapter.renderer';
import * as renderAdapter from './templating/templating-adapter.renderer';
import type { RuntimeCapabilities } from './types';

export const rendererRuntime = {
  network: networkAdapter,
  crypto: cryptAdapter,
  templating: renderAdapter,
  secretStorage: secretStorageAdapter,
  importer: importAdapter,
} satisfies RuntimeCapabilities;
