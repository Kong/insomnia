import { faker } from "@faker-js/faker";

import { ContextMenuItem } from "../../enums/context-menu-items";
import { ProjectType } from "../../enums/project-types";
import { expect, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify adding a query parameter or header focuses the new row's Name cell", async ({
  user,
}) => {
  test.fail(true, "INS-3587");
  const { workspaceFlow } = user.flowManager;
  const { workspacePage, httpRequestPage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const collectionNode = await workspacePage.resolveNode(collection);
  await workspacePage.rightClick(collectionNode);
  await workspacePage.clickContextMenu(ContextMenuItem.HttpRequest);
  await httpRequestPage.navigate();

  const paramNameContainer = await httpRequestPage.addParam();
  const paramNameFocused = await httpRequestPage.hasFocus(paramNameContainer);
  const headerNameContainer = await httpRequestPage.addHeader();
  const headerNameFocused = await httpRequestPage.hasFocus(headerNameContainer);

  expect(paramNameFocused).toBe(true);
  expect(headerNameFocused).toBe(true);
});

test("Verify opening a brand-new empty environment focuses its key/value editor's blank row Name cell", async ({
  user,
}) => {
  test.fail(true, "INS-3588");
  const { workspaceFlow, environmentFlow } = user.flowManager;
  const { environmentPage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const environmentName = faker.string.alphanumeric(10);

  await environmentFlow.create(project, {
    name: environmentName,
    kvPairData: [],
  });
  await environmentPage.selectEnvironment(environmentName);
  const blankRowFocused = await environmentPage.hasFocus(
    environmentPage.blankRowNameContainer,
  );

  expect(blankRowFocused).toBe(true);
});
