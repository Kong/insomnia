import path from 'node:path';

import type { CloudProviderCredential } from 'insomnia-data';
import { services } from 'insomnia-data';

// Shared trust-check helpers for template/plugin bridge handlers that hand a caller-supplied id or
// bodyPath to a services.* call. Used by both the sandboxed Nunjucks bridge
// (main/templating-worker-database.ts) and the unsandboxed Liquid tag path
// (templating/liquid-extension.ts) — see CROSS-TENANT-DB-ACCESS-FINDINGS.md Findings 1/4/5 for why
// each pattern exists.

// Read-side counterpart of the response.setBody write path's ownership check: rejects a bodyPath
// that isn't the stored bodyPath of an already-persisted response.
export const assertResponseBodyPathReadOwnership = async (bodyPath: string | undefined): Promise<void> => {
  if (!bodyPath) {
    return;
  }
  const existing = await services.response.getByBodyPath(path.resolve(bodyPath));
  if (!existing) {
    throw new Error('response.bodyPath does not belong to any known response');
  }
};

// Re-loads a response by id (when available) and reads only its own server-owned bodyPath,
// ignoring whatever bodyPath the caller supplied alongside it. Falls back to
// assertResponseBodyPathReadOwnership when no id is available (e.g. a response-hook call site that
// runs before the response is persisted).
export const readResponseBodyBufferOwned = async (
  response: { _id?: string; bodyPath?: string; bodyCompression?: any } | undefined,
  readFailureValue?: string,
): Promise<string | Buffer> => {
  const id = response?._id;
  if (id) {
    const real = await services.response.getById(String(id));
    if (!real) {
      return readFailureValue ?? '';
    }
    return await services.helpers.getResponseBodyBuffer(real, readFailureValue);
  }
  await assertResponseBodyPathReadOwnership(response?.bodyPath);
  return await services.helpers.getResponseBodyBuffer(response, readFailureValue);
};

// Re-loads a cloud credential by id and strips identity fields from the patch, so a caller can't
// forge type/_id/parentId to write into another collection. Throws if the id doesn't resolve to an
// existing credential.
export const reloadCloudCredentialForTrustedUpdate = async (
  originCredential: { _id?: string } | undefined,
  patch: Partial<CloudProviderCredential>,
): Promise<{ existing: CloudProviderCredential; patch: Partial<CloudProviderCredential> }> => {
  const id = String(originCredential?._id);
  const existing = await services.cloudCredential.getById(id);
  if (!existing) {
    throw new Error(`Cloud credential '${id}' not found`);
  }
  const stripped = { ...patch };
  delete (stripped as { _id?: unknown })._id;
  delete (stripped as { type?: unknown }).type;
  delete (stripped as { parentId?: unknown }).parentId;
  return { existing, patch: stripped };
};
