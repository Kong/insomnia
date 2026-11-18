import { execFileSync } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import path from "node:path";

import type { GitCredential } from "@package/models/git-credential";

import { GIT_SERVER as GIT_SERVER_URL, test as base } from "./fixtures";

// The most recently created repo (set by the `gitRepo` fixture), used as
// the default for getServerBranches()/getServerCommits() so specs don't
// have to thread it through explicitly. Safe as module state since
// playwright.config.ts enforces a single worker (and throws on --workers=N).
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
 * Commits a file onto `branch` of the bare repo on misc/server/git-http.ts, as if
 * a second client had pushed it — so the app under test sees the remote
 * move ahead without doing anything itself. `branch` is created from master
 * if it doesn't exist yet. With `delete`, removes the file instead.
 */
export async function pushServerFile(
  file: { path: string; content?: string; delete?: boolean; message?: string; branch?: string },
  gitRepo = currentGitRepo,
): Promise<void> {
  const res = await fetch(
    `${GIT_SERVER_URL}/_admin/repos/${requireGitRepo(gitRepo)}/files`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(file),
    },
  );
  if (!res.ok) {
    throw new Error(`pushServerFile(${file.path}) failed: ${res.status} ${await res.text()}`);
  }
}

/**
 * Applies file writes and/or deletions to a local Git Sync clone on disk
 * and commits them with the git CLI (nothing is pushed) — for files the
 * app has no UI to edit, e.g. a GitHub workflow.
 */
export function commitLocalFiles(
  repoPath: string,
  files: { path: string; content?: string; delete?: boolean }[],
  message: string,
): void {
  for (const file of files) {
    const target = path.join(repoPath, file.path);
    if (file.delete) {
      fs.rmSync(target, { force: true });
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.content ?? "");
    }
  }
  const git = (...args: string[]) => execFileSync("git", args, { cwd: repoPath });
  git("add", "--all");
  git("-c", "user.name=Local Author", "-c", "user.email=local@example.com", "commit", "-m", message);
}

/**
 * Builds the YAML for a minimal, empty Insomnia collection file, suitable
 * for `pushServerFile()` to make the app see a new collection on the remote.
 */
export function buildCollectionFile(name: string): string {
  const id = crypto.randomUUID().replaceAll("-", "");
  return [
    "type: collection.insomnia.rest/5.0",
    'schema_version: "5.1"',
    `name: ${name}`,
    "meta:",
    `  id: wrk_${id}`,
    "  created: 1700000000000",
    "  modified: 1700000000000",
    "collection: []",
    "",
  ].join("\n");
}

// Shared custom credential used to authenticate against misc/server/git-http.ts,
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

interface GitFixtures {
  /** The name of a repo freshly created (and seeded) on misc/server/git-http.ts — always local, never a full URL. */
  gitRepo: string;
}

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

export { DEFAULT_TIMEOUT } from "./fixtures";
