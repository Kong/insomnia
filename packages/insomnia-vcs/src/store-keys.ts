// Identifiers that originate from (or can be influenced by) the sync server end up as path
// segments in store keys. Every such identifier must be validated here before use so that a
// hostile server can never steer a read/write outside the intended directory.

// Blob ids are the sha1 hex digest of the document content (see `hash` in util.ts).
const BLOB_ID_PATTERN = /^[0-9a-f]{40}$/;

export function assertValidBlobId(blobId: unknown): asserts blobId is string {
  if (typeof blobId !== 'string' || !BLOB_ID_PATTERN.test(blobId)) {
    throw new Error('Invalid blob id');
  }
}

/** Store key for a blob, sharded by the first two hex characters of its id. */
export function blobKey(backendProjectId: string, blobId: string) {
  assertValidBlobId(blobId);
  return `/projects/${backendProjectId}/blobs/${blobId.slice(0, 2)}/${blobId.slice(2)}`;
}

// Snapshot ids are the sha1 hex digest produced by `_generateSnapshotID` in vcs.ts.
const SNAPSHOT_ID_PATTERN = /^[0-9a-f]{40}$/;

export function isValidSnapshotId(id: unknown): id is string {
  return typeof id === 'string' && SNAPSHOT_ID_PATTERN.test(id);
}

export function assertValidSnapshotId(id: unknown): asserts id is string {
  if (!isValidSnapshotId(id)) {
    throw new Error('Invalid snapshot id');
  }
}

// Backend project ids are generated locally as `prj_<32 hex>` (generateId), but projects created
// elsewhere are issued by the server, so only the character set and length are constrained.
const BACKEND_PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function isValidBackendProjectId(id: unknown): id is string {
  return typeof id === 'string' && BACKEND_PROJECT_ID_PATTERN.test(id);
}

export function assertValidBackendProjectId(id: unknown): asserts id is string {
  if (!isValidBackendProjectId(id)) {
    throw new Error('Invalid backend project id');
  }
}
