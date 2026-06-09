const throwError = () => {
  throw new Error('WebSocketRuntime not available in node');
};

export const open = throwError;
export const close = (_options: { requestId: string }) => {
  throw new Error('WebSocketRuntime not available in node');
};
export const closeAll = throwError;
export const readyState = { getCurrent: async () => { throw new Error('WebSocketRuntime not available in node'); } };
export const event = { findMany: async () => { throw new Error('WebSocketRuntime not available in node'); }, send: throwError };
