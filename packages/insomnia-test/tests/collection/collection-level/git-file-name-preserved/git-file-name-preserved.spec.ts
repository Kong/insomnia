import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";

import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { DEFAULT_TIMEOUT, MOCK_API_SERVER } from "@package/misc/constants";
import { test } from "@package/misc/fixtures";
import type { GitCredential } from "@package/models/git-credential";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

const GIT_CREDENTIAL: GitCredential = {
  name: "Custom Git Credential",
  authorEmail: "author@example.com",
  authorName: "Test Author",
  username: "testuser",
  password: "testpass",
};
const REPO_URL = `${MOCK_API_SERVER}/git/git-server.git`;
const FILE_NAME = "API v2.yaml";

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" });

test("Verify editing collection docs in a Git project keeps the collection file name", async ({ user }) => {
  test.fail(true, "INS-4319");
  const { workspaceFlow, collectionFlow, gitSyncFlow, preferencesFlow } = user.flowManager;

  const collectionName = faker.string.alphanumeric(10);
  const docs = faker.lorem.sentence();
  await fetch(`${MOCK_API_SERVER}/v1/test-utils/git/setup`, { method: "POST" });
  const seedDir = fs.mkdtempSync(path.join(os.tmpdir(), "insomnia-git-seed-"));
  git(seedDir, "clone", REPO_URL, ".");
  const fixture = fs.readFileSync(path.join(import.meta.dirname, "collection.yaml"), "utf8");
  fs.writeFileSync(path.join(seedDir, FILE_NAME), fixture.replace("Git collection file", collectionName));
  git(seedDir, "add", ".");
  git(seedDir, "-c", "user.name=seed", "-c", "user.email=seed@example.com", "commit", "-m", "seed");
  git(seedDir, "push", "origin", "HEAD:master");
  const committedFiles = () => {
    const verifyDir = fs.mkdtempSync(path.join(os.tmpdir(), "insomnia-git-verify-"));
    git(verifyDir, "clone", REPO_URL, ".");
    return git(verifyDir, "show", "--name-only", "--format=", "HEAD").split("\n").filter(Boolean);
  };

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  await workspaceFlow.cloneGitProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
    { uri: REPO_URL },
  );
  const collection = await workspaceFlow.getCollection(collectionName);
  await collectionFlow.setDocs(collection!, docs);
  await gitSyncFlow.commitAndPush(faker.lorem.words(3));

  await expect.poll(committedFiles, { timeout: DEFAULT_TIMEOUT }).toEqual([FILE_NAME]);
});
