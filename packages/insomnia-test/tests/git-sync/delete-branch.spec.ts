import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import {
  expect,
  getServerBranches,
  GIT_CREDENTIAL,
  test,
} from "../../misc/git-fixtures";
import { Project } from "../../models/project";

test("Verify deleting a branch checks out master and removes it from the list", async ({
  user,
}) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;
  
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );

  const branchName = faker.string.alphanumeric(10);
  await gitSyncFlow.createBranch(branchName);
  await gitSyncFlow.deleteBranch(branchName);

  const currentBranch = await gitSyncPage.getCurrentBranch();
  const serverBranches = await getServerBranches();

  expect(currentBranch).toBe("master");
  expect(serverBranches).toEqual(["master"]);
});
