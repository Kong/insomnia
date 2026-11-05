// `_id` and `parentId` of docs received from remote sources (cloud sync pulls, git repos) are later
// interpolated into on-disk names (proto temp files, response/timeline paths, git yaml names), so they
// must be a single safe path segment: no separators, dots, NUL or other special characters.
//
// The charset matches what generateId() produces ("<prefix>_<uuid-hex>") plus the fixed ids used by
// imports and legacy data (e.g. "__WORKSPACE_ID__", "__BASE_ENVIRONMENT_ID__", prefixes containing '-').
// The model prefix is deliberately NOT enforced: legacy and imported docs have ids that do not carry it.
const SAFE_SYNCED_ID_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;

export const isSafeSyncedId = (value: unknown): value is string =>
  typeof value === 'string' && SAFE_SYNCED_ID_PATTERN.test(value);

/**
 * Throws when a doc received from a remote source has an unsafe `_id`, an unsafe `parentId`
 * (null/undefined/'' are allowed), or a non-string `type`.
 */
export const assertSafeSyncedDoc = (doc: unknown): void => {
  const candidate = doc as { _id?: unknown; type?: unknown; parentId?: unknown } | null | undefined;
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Refusing synced document: not an object');
  }
  if (typeof candidate.type !== 'string') {
    throw new TypeError(`Refusing synced document "${String(candidate._id)}": invalid type`);
  }
  if (!isSafeSyncedId(candidate._id)) {
    throw new Error(`Refusing synced ${candidate.type} document: unsafe _id "${String(candidate._id)}"`);
  }
  const { parentId } = candidate;
  if (parentId !== null && parentId !== undefined && parentId !== '' && !isSafeSyncedId(parentId)) {
    throw new Error(`Refusing synced ${candidate.type} document "${candidate._id}": unsafe parentId "${String(parentId)}"`);
  }
};
