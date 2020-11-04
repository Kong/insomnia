// @flow

// The types of a call are defined in packages/insomnia-app/node_modules/@grpc/grpc-js/src/call.ts
// These are TS types and too complex to translate entirely to flow types
// A call can be a ClientUnaryCall, ClientReadableStream, ClientWritableStream, or ClientDuplexStream
// A call can also emit 'metadata' and 'status' events
type Call = Object;

const _calls: { [requestId: string]: Call } = {};

const get = (requestId: string): Call | undefined => {
  const call: Call = _calls[requestId];

  if (!call) {
    console.log('call not found');
  }

  return call;
};

const set = (requestId: string, call: Call): void => {
  _calls[requestId] = call;
};

const _getChannel = (requestId: string) => get(requestId)?.call?.call.channel;

const clear = (requestId: string): void => {
  _getChannel(requestId)?.close();
  delete _calls[requestId];
};

const callCache = { get, set, clear };

export default callCache;
