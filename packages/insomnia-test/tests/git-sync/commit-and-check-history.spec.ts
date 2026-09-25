import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import {
  expect,
  getServerCommits,
  GIT_CREDENTIAL,
  test,
} from "../../misc/git-fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify committing changes in a Git Sync project appears in History", async ({
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

  const message = faker.string.alphanumeric(10);
  const commit = await gitSyncFlow.commit(message);
  const serverCommits = await getServerCommits();

  expect(commit.message).toEqual(message);
  expect(commit.id).toBeDefined();
  expect(serverCommits.some((c) => c.id === commit.id)).toBe(false);
});
