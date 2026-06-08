import * as networkAdapter from '../../network/network-adapter.node';
import type { RuntimeCapabilities } from './types';

export const nodeRuntime = {
  network: networkAdapter,
} satisfies RuntimeCapabilities;
