import type { CloudProviderCredential, CloudProviderName } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';

const { type } = models.cloudCredential;

export function create(patch: Partial<CloudProviderCredential> = {}) {
  return db.docCreate<CloudProviderCredential>(type, patch);
}

export async function getById(id: string) {
  return db.findOne<CloudProviderCredential>(type, { _id: id });
}

export function update(credential: CloudProviderCredential, patch: Partial<CloudProviderCredential>) {
  return db.docUpdate<CloudProviderCredential>(credential, patch);
}

export function remove(credential: CloudProviderCredential) {
  return db.remove(credential);
}

export function getByName(name: string, provider: CloudProviderName) {
  return db.find<CloudProviderCredential>(type, { name, provider });
}

export function all() {
  return db.find<CloudProviderCredential>(type);
}
