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

// Buffer and Date degrade across the Electron utilityProcess MessagePort boundary
// (Buffer -> Uint8Array, Date empirically fails despite HTML spec saying it should survive).
// Applied at the transport layer by PortRpc and entry.data.ts.

const BUFFER_TAG = '__buffer__';
const DATE_TAG = '__date__';

interface TaggedBuffer {
  [BUFFER_TAG]: true;
  data: Uint8Array;
}

interface TaggedDate {
  [DATE_TAG]: true;
  ms: number;
}

function isTaggedBuffer(v: unknown): v is TaggedBuffer {
  return typeof v === 'object' && v !== null && (v as TaggedBuffer)[BUFFER_TAG] === true;
}

function isTaggedDate(v: unknown): v is TaggedDate {
  return typeof v === 'object' && v !== null && (v as TaggedDate)[DATE_TAG] === true;
}

export function serializeValue(v: unknown): unknown {
  if (Buffer.isBuffer(v)) {
    return { [BUFFER_TAG]: true, data: new Uint8Array(v) } satisfies TaggedBuffer;
  }
  if (v instanceof Date) {
    return { [DATE_TAG]: true, ms: v.getTime() } satisfies TaggedDate;
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
  if (isTaggedDate(v)) {
    return new Date(v.ms);
  }
  if (Array.isArray(v)) {
    return v.map(deserializeValue);
  }
  if (typeof v === 'object' && v !== null) {
    return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, deserializeValue(val)]));
  }
  return v;
}
