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

const BUFFER_TAG = '__buffer__';

interface TaggedBuffer {
  [BUFFER_TAG]: true;
  data: number[];
}

function isTaggedBuffer(v: unknown): v is TaggedBuffer {
  return typeof v === 'object' && v !== null && (v as TaggedBuffer)[BUFFER_TAG] === true;
}

export function serializeValue(v: unknown): unknown {
  if (Buffer.isBuffer(v)) {
    return { [BUFFER_TAG]: true, data: Array.from(v) } satisfies TaggedBuffer;
  }
  if (Array.isArray(v)) {
    return v.map(serializeValue);
  }
  if (typeof v === 'object' && v !== null) {
    return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, serializeValue(val)]));
  }
  return v;
}

export function deserializeValue(v: unknown): unknown {
  if (isTaggedBuffer(v)) {
    return Buffer.from(v.data);
  }
  if (Array.isArray(v)) {
    return v.map(deserializeValue);
  }
  if (typeof v === 'object' && v !== null) {
    return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, deserializeValue(val)]));
  }
  return v;
}
