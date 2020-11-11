// @flow

// The types of a call are defined in packages/insomnia-app/node_modules/@grpc/grpc-js/src/call.ts
// These are TS types and too complex to translate entirely to flow types
// A call can be a ClientUnaryCall, ClientReadableStream, ClientWritableStream, or ClientDuplexStream
// A call can also emit 'metadata' and 'status' events
export type Call = Object;

let _calls: { [requestId: string]: Call } = {};

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

const callCache = { get, set, clear, reset };

export default callCache;
