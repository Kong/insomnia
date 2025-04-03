import { database as db } from '../common/database';
import type { GitCredentials } from '../sync/git/git-vcs';
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

export const isGitRepository = (model: Pick<BaseModel, 'type'>): model is GitRepository => (
  model.type === type
);

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
  return db.getWhere<GitRepository>(type, { _id: id });
}

export function update(repo: GitRepository, patch: Partial<GitRepository>) {
  return db.docUpdate<GitRepository>(repo, patch);
}

export function remove(repo: GitRepository) {
  return db.remove(repo);
}

export function all() {
  return db.all<GitRepository>(type);
}
