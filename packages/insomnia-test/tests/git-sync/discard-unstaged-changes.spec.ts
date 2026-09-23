import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import {
  DEFAULT_TIMEOUT,
  expect,
  getServerCommits,
  GIT_CREDENTIAL,
  test,
} from "../../misc/git-fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify discarding all unstaged changes removes the uncommitted collection", async ({
  user,
}) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
    faker.string.alphanumeric(10),
  );
  await gitSyncFlow.discardAllChanges();

  await expect
    .poll(async () => workspacePage.findItemNode(collection), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBeUndefined();

  const serverCommits = await getServerCommits();

  expect(serverCommits).toHaveLength(1);
});
