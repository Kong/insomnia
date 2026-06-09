import * as networkAdapter from '../../network/network-adapter.renderer';
import * as renderAdapter from '../../templating/render-adapter.renderer';
import * as cryptAdapter from '../../utils/crypt-adapter.renderer';
import type { RuntimeCapabilities } from './types';

export const rendererRuntime = {
  network: networkAdapter,
  crypto: cryptAdapter,
  templating: renderAdapter,
} satisfies RuntimeCapabilities;
