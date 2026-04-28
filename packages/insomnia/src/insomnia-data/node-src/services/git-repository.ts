import type { GitRepository } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';

const type = models.gitRepository.type;

export function create(patch: Partial<GitRepository> = {}) {
  return db.docCreate<GitRepository>(type, {
    uriNeedsMigration: false,
    ...patch,
  });
}

export async function getById(id: string) {
  return db.findOne<GitRepository>(type, { _id: id });
}

export async function getAllByCredentialId(credentialsId: string) {
  return db.find<GitRepository>(type, { credentialsId });
}

export function update(repo: GitRepository, patch: Partial<GitRepository>) {
  return db.docUpdate<GitRepository>(repo, patch);
}

export function remove(repo: GitRepository) {
  return db.remove(repo);
}

export function all() {
  return db.find<GitRepository>(type);
}
