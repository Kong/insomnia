export interface SerializedError {
  name: string;
  message: string;
  stack: string;
}

export function serializeError(e: unknown): SerializedError {
  if (e instanceof Error) {
    return { name: e.name, message: e.message, stack: e.stack ?? '' };
  }
  return { name: 'Error', message: String(e), stack: '' };
}

export function deserializeError(s: SerializedError): Error {
  const err = new Error(s.message);
  err.name = s.name;
  err.stack = s.stack;
  return err;
}
