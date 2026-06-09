const error = new Error('GrpcRuntime not available in node');
const throwError = () => {
  throw error;
};
const rejectPromise = () => Promise.reject(error);

export const start = throwError;
export const sendMessage = throwError;
export const commit = throwError;
export const cancel = throwError;
export const loadMethods = rejectPromise;
export const loadMethodsFromReflection = rejectPromise;
export const closeAll = throwError;
export const writeProtoFile = rejectPromise;
export const validateProtoFile = rejectPromise;
