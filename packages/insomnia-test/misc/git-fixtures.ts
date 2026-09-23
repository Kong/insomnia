import * as crypto from "crypto";
import { test as base, GIT_SERVER as GIT_SERVER_URL } from "./fixtures";
import { GitCredential } from "../models/git-credential";

// The most recently created repo (set by the `gitRepo` fixture), used as
// the default for getServerBranches()/getServerCommits() so specs don't
// have to thread it through explicitly. Safe as module state since
// playwright.config.ts runs this suite with workers: 1 (fully serial).
let currentGitRepo: string | undefined;

function requireGitRepo(gitRepo: string | undefined): string {
  if (!gitRepo) {
    throw new Error(
      "No gitRepo given and none created yet — use the `gitRepo` fixture (or the `user` fixture, which depends on it) before calling this",
    );
  }
  return gitRepo;
}

/**
 * Reads the real local branch names from the bare repo on misc/git-server.js
 * — ground truth for what's actually been pushed, independent of anything
 * the app's UI reports.
 * @param gitRepo - The repo name; defaults to the one created by the `gitRepo` fixture
 * @returns The repo's local branch names
 */
export async function getServerBranches(
  gitRepo = currentGitRepo,
): Promise<string[]> {
  const res = await fetch(
    `${GIT_SERVER_URL}/_admin/repos/${requireGitRepo(gitRepo)}/branches`,
  );
  return (await res.json()).branches;
}

/**
 * Overrides misc/git-server.js's Basic auth requirement for one repo only
 * — e.g. to test bad credentials or a disabled-auth repo. Scoped to
 * `gitRepo` by name, so it can never leak into another test's repo.
 * @param gitRepo - The repo name; defaults to the one created by the `gitRepo` fixture
 * @param overrides - Fields to change; omitted fields keep their current value
 */
export async function setGitRepoAuth(
  overrides: { enabled?: boolean; username?: string; password?: string },
  gitRepo = currentGitRepo,
): Promise<void> {
  await fetch(
    `${GIT_SERVER_URL}/_admin/repos/${requireGitRepo(gitRepo)}/auth`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(overrides),
    },
  );
}

export interface ServerCommit {
  id: string;
  message: string;
  authorName: string;
  authorEmail: string;
}

/**
 * Reads the real commit history for `branch` from the bare repo on
 * misc/git-server.js (newest first) — ground truth for what's actually
 * been pushed, independent of anything the app's UI reports.
 * @param gitRepo - The repo name; defaults to the one created by the `gitRepo` fixture
 * @param branch - The branch to read; defaults to "master"
 * @returns The branch's commits, or `[]` if the branch doesn't exist on the server
 */
export async function getServerCommits(
  gitRepo = currentGitRepo,
  branch = "master",
): Promise<ServerCommit[]> {
  const res = await fetch(
    `${GIT_SERVER_URL}/_admin/repos/${requireGitRepo(gitRepo)}/commits?branch=${encodeURIComponent(branch)}`,
  );
  return (await res.json()).commits;
}

// Shared custom credential used to authenticate against misc/git-server.js,
// whose default Basic auth is testuser/testpass. `name` is the app's own
// hardcoded display name for any custom (username/PAT) credential (see
// git-custom-credential-form.tsx) — it isn't something we choose, so unlike
// other names in these tests it can't be faker-generated.
export const GIT_CREDENTIAL: GitCredential = {
  name: "Custom Git Credential",
  authorEmail: "author@example.com",
  authorName: "Test Author",
  username: "testuser",
  password: "testpass",
};

type GitFixtures = {
  /** The name of a repo freshly created (and seeded) on misc/git-server.js — always local, never a full URL. */
  gitRepo: string;
};

export const test = base.extend<GitFixtures>({
  gitRepo: async ({}, use) => {
    const repoName = `${crypto.randomUUID()}.git`;
    await fetch(`${GIT_SERVER_URL}/_admin/repos/${repoName}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed: true }),
    });
    currentGitRepo = repoName;
    await use(repoName);
    await fetch(`${GIT_SERVER_URL}/_admin/repos/${repoName}`, {
      method: "DELETE",
    });
  },

  // Overrides the base `gitCloneUrl` fixture (which the base `user` fixture
  // consumes) so GitSyncFlow.cloneFromRemote() can default to this repo
  // without every spec having to thread it through. Deliberately not
  // overriding `user` itself — that would mean reimplementing it here and
  // risking it drifting from the base fixture's defaults (which is exactly
  // what happened with sidebarFocusForCollections; see fixtures.ts).
  gitCloneUrl: async ({ gitRepo }, use) => {
    await use(`${GIT_SERVER_URL}/${gitRepo}`);
  },
});

export { expect } from "@playwright/test";
export { DEFAULT_TIMEOUT } from "./fixtures";
