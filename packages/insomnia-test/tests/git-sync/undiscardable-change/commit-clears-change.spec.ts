import { faker } from "@faker-js/faker";

import { ProjectType } from "../../../enums/project-types";
import {
  DEFAULT_TIMEOUT,
  expect,
  GIT_CREDENTIAL,
  pushServerFile,
  test,
} from "../../../misc/git-fixtures";
import { Project } from "../../../models/project";
import { buildReorderedCollectionFile } from "./helpers";

test("Verify committing a hand-reordered file once leaves the working tree clean", async ({
  user,
}) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  await pushServerFile({
    path: fileName,
    content: buildReorderedCollectionFile(faker.string.alpha(10)).content,
  });
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged, {
      timeout: DEFAULT_TIMEOUT,
    })
    .toContain(fileName);
  const message = faker.string.alphanumeric(10);
  const commit = await gitSyncFlow.commit(message);

  await expect
    .poll(async () => gitSyncPage.hasUncommittedChanges(), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBe(false);
  expect(commit.message).toBe(message);
});
