import * as networkAdapter from '../../network/network-adapter.renderer';
import type { RuntimeCapabilities } from './types';

export const rendererRuntime = {
  network: networkAdapter,
} satisfies RuntimeCapabilities;
