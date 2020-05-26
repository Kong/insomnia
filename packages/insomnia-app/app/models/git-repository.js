// @flow
import type { BaseModel } from './index';

import * as db from '../common/database';
import type { GitCredentials } from '../sync/git/git-vcs';

type BaseGitRepository = {
  needsFullClone: boolean,
  uri: string,
  credentials: GitCredentials | null,
  author: {
    name: string,
    email: string,
  },
};

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
  };
}

export function migrate<T>(doc: T): T {
  return doc;
}

export function create(patch: $Shape<GitRepository> = {}): Promise<GitRepository> {
  return db.docCreate(type, patch);
}

export function update(repo: GitRepository, patch: $Shape<GitRepository>): Promise<GitRepository> {
  return db.docUpdate(repo, patch);
}

export function remove(repo: GitRepository): Promise<void> {
  return db.remove(repo);
}

export function all(): Promise<Array<GitRepository>> {
  return db.all(type);
}
