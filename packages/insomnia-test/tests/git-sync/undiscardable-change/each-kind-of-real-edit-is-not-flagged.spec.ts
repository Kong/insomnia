import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { GitChangeList } from "../../../enums/git-change-list";
import { HttpMethod } from "../../../enums/http-method";
import { ProjectType } from "../../../enums/project-types";
import { HTTP_SERVER } from "../../../misc/constants";
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from "../../../misc/git-fixtures";
import { Collection } from "../../../models/collection";
import { Project } from "../../../models/project";
import { buildReorderedCollectionFile } from "./helpers";

test("Verify each kind of real edit on a reordered file is not flagged as only reformatting", async ({
  user,
}) => {
  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } =
    user.flowManager;
  const { gitSyncPage, httpRequestPage } = user.pageManager;

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const collectionName = faker.string.alpha(10);
  const { content, requestName } = buildReorderedCollectionFile(collectionName);
  await pushServerFile({ path: fileName, content });
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  await workspaceFlow.cloneGitProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const request = await httpRequestFlow.get(
    requestName,
    new Collection(collectionName),
  );
  const edits = [
    () => workspaceFlow.renameRequest(request!, faker.string.alphanumeric(10)),
    () => httpRequestPage.setUrl(`${HTTP_SERVER}/${faker.string.alpha(10)}`),
    () => httpRequestPage.setMethod(HttpMethod.Post),
    () =>
      httpRequestPage.setHeaders([
        { name: faker.string.alpha(8), value: faker.string.alpha(8) },
      ]),
  ];
  const warningsPerEdit: boolean[] = [];
  for (const edit of edits) {
    await edit();
    await expect
      .poll(async () => (await gitSyncFlow.getChanges()).unstaged, {
        timeout: DEFAULT_TIMEOUT,
      })
      .toContain(fileName);
    await gitSyncPage.openCommitDialog();
    await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, fileName);
    warningsPerEdit.push(
      await gitSyncPage.isUndiscardableWarningVisible(),
    );
    await gitSyncPage.closeCommitDialog();
    await gitSyncFlow.discardChangeAfterReview(fileName);
    await expect
      .poll(
        async () => {
          await gitSyncPage.openCommitDialog();
          await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, fileName);
          const hasWarning =
            await gitSyncPage.isUndiscardableWarningVisible();
          await gitSyncPage.closeCommitDialog();
          return hasWarning;
        },
        { timeout: DEFAULT_TIMEOUT },
      )
      .toBe(true);
  }

  expect(warningsPerEdit).toEqual(edits.map(() => false));
});
