import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { expect, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify the legacy unit test setting defaults off and hides the Tests tab for a profile with no existing test suites", async ({
  user,
}) => {
  const { workspaceFlow } = user.flowManager;
  const { workspacePage, preferencesPage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const collectionNode = await workspacePage.resolveNode(collection);
  await workspacePage.clickNode(collectionNode);
  const testsTabVisibleBeforeEnabling = await user.page
    .getByRole("tab", { name: "Tests" })
    .isVisible();

  await preferencesPage.open();
  const enabledByDefault = await preferencesPage.isShowLegacyUnitTestsEnabled();
  await preferencesPage.close();

  expect(enabledByDefault).toBe(false);
  expect(testsTabVisibleBeforeEnabling).toBe(false);
});
