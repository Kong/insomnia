import type { BaseModel } from '~/models/types';

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
    credentialsId: null,
    selectedAuthorEmail: null,
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
  /**
   * @deprecated Use credentialsId instead
   */
  credentials: GitRepoCredentials | null;
  credentialsId: string | null;
  /**
   * Optional override for the author email address used for commits
   * Must be a value from the emails list of the corresponding credential
   */
  selectedAuthorEmail: string | null;
  /**
   * @deprecated Use the author in the corresponding credential
   */
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

export type GitRepoCredentials = GitCredentialsBase | GitCredentialsOAuth;

export const isGitCredentialsOAuth = (credentials: GitRepoCredentials): credentials is GitCredentialsOAuth => {
  return 'oauth2format' in credentials;
};
