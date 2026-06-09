const error = new Error('WebSocketRuntime not available in node');
const throwError = () => {
  throw error;
};

export const open = throwError;
export const close = throwError;
export const closeAll = throwError;
export const readyState = { getCurrent: () => Promise.reject(error) };
export const event = { findMany: () => Promise.reject(error), send: throwError };
