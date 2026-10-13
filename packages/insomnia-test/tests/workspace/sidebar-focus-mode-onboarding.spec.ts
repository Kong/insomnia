import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection, Info, Specification } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify the sidebar focus mode onboarding popover shows once and stays dismissed after a reload, and narrows/un-narrows the sidebar for a spec-carrying API Collection", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, preferencesFlow } = user.flowManager;
  const { workspacePage, preferencesPage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const specPath = `/${faker.word.sample()}`;
  const spec = new Specification(
    new Info(faker.company.name(), faker.system.semver()),
    {
      [specPath]: {
        get: {
          operationId: "listItems",
          responses: { "200": { description: "OK" } },
        },
      },
    },
  );
  const collection1 = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10), spec),
  );
  const collection2 = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const requestInCollection1 = await httpRequestFlow.create(collection1, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });

  const collection1Node = await workspacePage.resolveNode(collection1);
  await preferencesFlow.set({ sidebarFocusForCollections: true });
  await workspacePage.clickNode(collection1Node);

  const shownOnFirstFocus = await workspaceFlow.dismissFocusModePrompt();
  const nodesWhileFocused = await workspacePage.getNodes();
  await workspaceFlow.getByPalette(collection2.name);
  const shownAfterFocusingAnotherCollection =
    await workspaceFlow.dismissFocusModePrompt();
  const nodesAfterSwitchingCollection = await workspacePage.getNodes();

  await user.page.reload({ waitUntil: "networkidle" });
  const shownAfterReload = await workspaceFlow.dismissFocusModePrompt();

  await preferencesPage.open();
  const stillEnabledAfterReload =
    await preferencesPage.isSidebarFocusForCollectionsEnabled();
  await preferencesPage.close();

  expect(shownOnFirstFocus).toBe(true);
  expect(shownAfterFocusingAnotherCollection).toBe(false);
  expect(shownAfterReload).toBe(false);
  expect(stillEnabledAfterReload).toBe(true);
  expect(
    nodesWhileFocused.some((n) => n._id.includes(collection2.id!)),
  ).toBe(false);
  expect(
    nodesWhileFocused.some((n) => n._id === requestInCollection1.id),
  ).toBe(true);
  expect(
    nodesAfterSwitchingCollection.some((n) => n._id.includes(collection2.id!)),
  ).toBe(true);
  expect(
    nodesAfterSwitchingCollection.some((n) => n._id.includes(collection1.id!)),
  ).toBe(false);
});

test("Verify the sidebar focus mode onboarding popover never shows while the setting is off", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, preferencesFlow } = user.flowManager;

  await preferencesFlow.set({ sidebarFocusForCollections: false });

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });

  const shown = await workspaceFlow.dismissFocusModePrompt();

  expect(shown).toBe(false);
});
