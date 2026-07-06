import type { BaseGitCredentialsV2, GitCredentials, GitCredentialsV2 } from 'insomnia-data';
import { database as db, models } from 'insomnia-data';

const { type } = models.gitCredentials;

export function create(patch: BaseGitCredentialsV2) {
  return db.docCreate<GitCredentialsV2>(type, patch);
}

export async function getById(id: string) {
  const doc = await db.findOne<GitCredentials>(type, { _id: id });
  return doc ?? null;
}

export function update(credentials: GitCredentialsV2, patch: Partial<GitCredentialsV2>) {
  return db.docUpdate<GitCredentialsV2>(credentials, patch);
}

export function remove(credentials: GitCredentials) {
  return db.remove(credentials);
}

export async function all() {
  return await db.find<GitCredentials>(type);
}

export function removeAll() {
  return db.removeWhere<GitCredentials>(type, {});
}
