import type { BaseModel } from './base-types';

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
    repoMigrationVersion: 0,
    directory: null,
    folderSlug: null,
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
  /**
   * Tracks which version of the on-disk repo structure migration has run.
   * When an older app version processes this document via docUpdate it will
   * prune this field (since its init() doesn't include it), which causes the
   * migration to re-run on the next upgrade — exactly the desired behaviour
   * for version-rollback scenarios.
   */
  repoMigrationVersion: number;
  /**
   * Absolute path to a user-chosen location on the local filesystem where this
   * repository's working tree and .git directory live.
   *
   * `null` (the default) means the repository is stored in the app-managed
   * location: `{INSOMNIA_DATA_PATH || userData}/version-control/git/{folder}`,
   * where `folder` is computed by {@link getGitRepoFolderName}. Insomnia owns
   * that managed folder. When `directory` is set, the user owns the folder and
   * Insomnia must not delete it on project removal.
   */
  directory: string | null;
  /**
   * A filesystem-safe slug derived from the owning project's name at the time
   * the app-managed folder was created (or, for repos that predate this field,
   * backfilled by a one-time best-effort startup pass before the window is
   * created). It is baked into the managed folder name for readability (see
   * {@link getGitRepoFolderName}) and is intentionally NOT kept in sync with
   * later project renames — renaming the folder on every project rename would
   * risk moving a directory out from under an open editor, terminal, or
   * native git process.
   *
   * `null` means either the repo uses a user-chosen `directory` (irrelevant),
   * or the folder still uses its legacy bare-id name.
   */
  folderSlug: string | null;
}

export const isGitRepository = (model: Pick<BaseModel, 'type'>): model is GitRepository => model.type === type;

// `folderSlug` is only ever written via `slugify()`, which already restricts
// its output to this charset — this is a second, independent check at the
// point the value gets baked into a filesystem path, so a corrupted or
// otherwise unsanitized `folderSlug` can never introduce a path separator or
// a `..` traversal segment into the computed folder name.
const SAFE_FOLDER_SLUG_PATTERN = /^[a-z0-9-]+$/;

/**
 * Computes the on-disk folder name for a Git repository's app-managed
 * location: `git_<slug>_<hex>` when a `folderSlug` snapshot is available,
 * otherwise the bare `_id` (e.g. pre-existing repos not yet backfilled).
 */
export function getGitRepoFolderName(repo: Pick<GitRepository, '_id' | 'folderSlug'>): string {
  if (!repo.folderSlug || !SAFE_FOLDER_SLUG_PATTERN.test(repo.folderSlug)) {
    return repo._id;
  }
  const hex = repo._id.startsWith(`${prefix}_`) ? repo._id.slice(prefix.length + 1) : repo._id;
  return `${prefix}_${repo.folderSlug}_${hex}`;
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

export type GitRepoCredentials = GitCredentialsBase | GitCredentialsOAuth;

export const isGitCredentialsOAuth = (credentials: GitRepoCredentials): credentials is GitCredentialsOAuth => {
  return 'oauth2format' in credentials;
};
