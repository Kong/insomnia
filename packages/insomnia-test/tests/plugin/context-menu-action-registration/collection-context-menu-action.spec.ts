import * as fs from "node:fs";
import path from "node:path";

import { faker } from "@faker-js/faker";

import { ProjectType } from "../../../enums/project-types";
import { DEFAULT_TIMEOUT,expect, test } from "../../../misc/fixtures";
import { Collection } from "../../../models/collection";
import { Project } from "../../../models/project";

test("Verify a plugin's context-menu action shows the Collection's name and type in a modal", async ({
  user,
}) => {
  test.fail(true, "INS-3521");

  const { appFlow, workspaceFlow } = user.flowManager;
  const { preferencesPage, workspacePage } = user.pageManager;

  const actionLabel = "Show Collection Info";
  const dataPath = await appFlow.getDataPath();
  const pluginDir = path.join(dataPath, "plugins", `insomnia-plugin-test`);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.copyFileSync(
    path.join(__dirname, "plugin-package.json"),
    path.join(pluginDir, "package.json"),
  );
  fs.copyFileSync(
    path.join(__dirname, "plugin-main.js"),
    path.join(pluginDir, "main.js"),
  );
  await preferencesPage.reloadPlugins();

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  await workspacePage.clickItemContextMenu(collection.name, actionLabel);
  const dialog = user.page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  const dialogText = await dialog.innerText();

  expect(dialogText).toContain(collection.name);
  expect(dialogText).toContain("Collection");
});
