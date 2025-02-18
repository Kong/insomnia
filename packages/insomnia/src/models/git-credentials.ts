import { database as db } from '../common/database';
import type { BaseModel } from './index';

export type OauthProviderName = 'gitlab' | 'github';

export type GitCredentials = BaseModel & BaseGitCredentials;

export const name = 'Git Credentials';

export const type = 'GitCredentials';

export const prefix = 'git_creds';

export const canDuplicate = false;

export const canSync = false;

export function init(): BaseGitCredentials {
  return {
    token: '',
    refreshToken: '',
    provider: 'github',
    author: {
      email: '',
      name: '',
      avatarUrl: '',
    },
  };
}

interface BaseGitCredentials {
  token: string;
  refreshToken?: string;
  provider: 'githubapp' | 'github' | 'gitlab' | 'custom';
  author: {
    avatarUrl?: string;
    name: string;
    email: string;
  };
}

export function migrate(doc: GitCredentials) {
  return doc;
}

export function create(patch: Partial<GitCredentials> = {}) {
  return db.docCreate<GitCredentials>(type, patch);
}

export async function getById(id: string) {
  return db.getWhere<GitCredentials>(type, { _id: id });
}

export async function getByProvider(provider: OauthProviderName) {
  return db.getWhere<GitCredentials>(type, provider === 'github' ? { provider: 'githubapp' } : { provider: 'gitlab' });
}

export function update(credentials: GitCredentials, patch: Partial<GitCredentials>) {
  return db.docUpdate<GitCredentials>(credentials, patch);
}

export function remove(credentials: GitCredentials) {
  return db.remove(credentials);
}

export function all() {
  return db.all<GitCredentials>(type);
}
