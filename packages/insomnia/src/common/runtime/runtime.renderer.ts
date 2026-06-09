import * as cookiesAdapter from '../../network/cookies-adapter.renderer';
import * as grpcAdapter from '../../network/grpc-adapter.renderer';
import * as networkAdapter from '../../network/network-adapter.renderer';
import * as socketIOAdapter from '../../network/socket-io-adapter.renderer';
import * as websocketAdapter from '../../network/websocket-adapter.renderer';
import * as renderAdapter from '../../templating/render-adapter.renderer';
import * as cryptAdapter from '../../utils/crypt-adapter.renderer';
import * as secretStorageAdapter from '../../utils/secret-storage-adapter.renderer';
import type { RuntimeCapabilities } from './types';

export const rendererRuntime = {
  network: networkAdapter,
  crypto: cryptAdapter,
  templating: renderAdapter,
  secretStorage: secretStorageAdapter,
  webSocket: websocketAdapter,
  socketIO: socketIOAdapter,
  grpc: grpcAdapter,
  cookies: cookiesAdapter,
} satisfies RuntimeCapabilities;
