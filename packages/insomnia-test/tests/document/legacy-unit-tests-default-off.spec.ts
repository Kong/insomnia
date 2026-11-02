import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify the legacy unit test setting defaults off and hides the Tests tab for a profile with no existing test suites", async ({
  user,
}) => {
  const { workspaceFlow } = user.flowManager;
  const { workspacePage, preferencesPage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const collectionNode = await workspacePage.resolveNode(collection);
  await workspacePage.clickNode(collectionNode);
  const testsTabVisibleBeforeEnabling = user.page
    .getByRole("tab", { name: "Tests" })
    ;

  await preferencesPage.open();
  const enabledByDefault = await preferencesPage.isShowLegacyUnitTestsEnabled();
  await preferencesPage.close();

  expect(enabledByDefault).toBe(false);
  await expect(testsTabVisibleBeforeEnabling).toBeHidden();
});
