import * as cookiesAdapter from '../../network/cookies-adapter.node';
import * as grpcAdapter from '../../network/grpc-adapter.node';
import * as networkAdapter from '../../network/network-adapter.node';
import * as socketIOAdapter from '../../network/socket-io-adapter.node';
import * as websocketAdapter from '../../network/websocket-adapter.node';
import * as renderAdapter from '../../templating/render-adapter.node';
import * as cryptAdapter from '../../utils/crypt-adapter.node';
import * as secretStorageAdapter from '../../utils/secret-storage-adapter.node';
import type { RuntimeCapabilities } from './types';

export const nodeRuntime = {
  network: networkAdapter,
  crypto: cryptAdapter,
  templating: renderAdapter,
  secretStorage: secretStorageAdapter,
  webSocket: websocketAdapter,
  socketIO: socketIOAdapter,
  grpc: grpcAdapter,
  cookies: cookiesAdapter,
} satisfies RuntimeCapabilities;
