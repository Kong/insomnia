import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import {
  expect,
  getServerBranches,
  getServerCommits,
  GIT_CREDENTIAL,
  test,
} from "../../misc/git-fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify pushing committed changes to the remote succeeds", async ({
  user,
}) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
    faker.string.alphanumeric(10),
  );
  const commit = await gitSyncFlow.commitAndPush(faker.string.alphanumeric(10));

  const branches = await getServerBranches();
  const commits = await getServerCommits();

  expect(branches).toContain("master");
  expect(commits).toContainEqual(
    expect.objectContaining({ id: commit.id, message: commit.message }),
  );
});
