import * as networkAdapter from '../../network/network-adapter.node';
import * as renderAdapter from '../../templating/render-adapter.node';
import * as cryptAdapter from '../../utils/crypt-adapter.node';
import type { RuntimeCapabilities } from './types';

export const nodeRuntime = {
  network: networkAdapter,
  crypto: cryptAdapter,
  templating: renderAdapter,
} satisfies RuntimeCapabilities;
