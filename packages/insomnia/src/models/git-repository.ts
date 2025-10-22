import { database as db } from '../common/database';
import type { BaseModel } from './index';

export type OauthProviderName = 'gitlab' | 'github' | 'custom';

export type GitRepository = BaseModel & BaseGitRepository;

export const name = 'Git Repository';

export const type = 'GitRepository';

export const prefix = 'git';

export const canDuplicate = false;

export const canSync = false;

export function init(): BaseGitRepository {
  return {
    needsFullClone: false,
    uri: '',
    credentials: null,
    author: {
      name: '',
      email: '',
    },
    cachedGitLastCommitTime: null,
    cachedGitRepositoryBranch: null,
    cachedGitLastAuthor: null,
    hasUncommittedChanges: false,
    hasUnpushedChanges: false,
    uriNeedsMigration: true,
  };
}

export interface BaseGitRepository {
  needsFullClone: boolean;
  uri: string;
  credentials: GitCredentials | null;
  author: {
    name: string;
    email: string;
  };
  hasUncommittedChanges: boolean;
  cachedGitLastCommitTime: number | null;
  cachedGitRepositoryBranch: string | null;
  cachedGitLastAuthor: string | null;
  hasUnpushedChanges: boolean;
  uriNeedsMigration: boolean;
}

export const isGitRepository = (model: Pick<BaseModel, 'type'>): model is GitRepository => model.type === type;

export function migrate(doc: GitRepository) {
  return doc;
}

export function create(patch: Partial<GitRepository> = {}) {
  return db.docCreate<GitRepository>(type, {
    uriNeedsMigration: false,
    ...patch,
  });
}

export async function getById(id: string) {
  return db.findOne<GitRepository>(type, { _id: id });
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
export interface GitAuthor {
  name: string;
  email: string;
}

export interface GitRemoteConfig {
  remote: string;
  url: string;
}
interface GitCredentialsBase {
  username: string;
  password: string;
}
interface GitCredentialsOAuth {
  /**
   * Supported OAuth formats.
   * This is needed by isomorphic-git to be able to push/pull using an oauth2 token.
   * https://isomorphic-git.org/docs/en/authentication.html
   */
  oauth2format?: 'github' | 'gitlab';
  username: string;
  token: string;
}

export type GitCredentials = GitCredentialsBase | GitCredentialsOAuth;

export const isGitCredentialsOAuth = (credentials: GitCredentials): credentials is GitCredentialsOAuth => {
  return 'oauth2format' in credentials;
};
