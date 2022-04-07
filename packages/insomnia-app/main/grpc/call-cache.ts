import { Call } from '@grpc/grpc-js';

// A call can also emit 'metadata' and 'status' events
let _calls: Record<string, Call> = {};

const activeCount = () => Object.keys(_calls).length;

const get = (requestId: string): Call | undefined => {
  const call: Call = _calls[requestId];

  if (!call) {
    console.log(`[gRPC] client call for req=${requestId} not found`);
  }

  return call;
};

const set = (requestId: string, call: Call): void => {
  _calls[requestId] = call;
};

const _tryCloseChannel = (requestId: string) => {
  // @ts-expect-error -- TSCONVERSION channel not found in call
  const channel = get(requestId)?.call?.call.channel;

  if (channel) {
    channel.close();
  } else {
    console.log(`[gRPC] failed to close channel for req=${requestId} because it was not found`);
  }
};

const clear = (requestId: string): void => {
  _tryCloseChannel(requestId);

  delete _calls[requestId];
};

const reset = (): void => {
  _calls = {};
};

const callCache = {
  activeCount,
  get,
  set,
  clear,
  reset,
};
export default callCache;
