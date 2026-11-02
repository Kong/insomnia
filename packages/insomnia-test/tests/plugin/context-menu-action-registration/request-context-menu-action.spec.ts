import * as fs from 'node:fs';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { HttpMethod } from '@package/enums/http-method';
import { ProjectType } from '@package/enums/project-types';
import { DEFAULT_TIMEOUT, HTTP_SERVER, test } from '@package/misc/fixtures';
import { Collection } from '@package/models/collection';
import type { HttpRequest } from '@package/models/http-request';
import { Project } from '@package/models/project';

test(
  "Verify a plugin's context-menu action shows the target item's name and type in a modal",
  async ({ user }) => {

    const { appFlow, workspaceFlow, httpRequestFlow } = user.flowManager;
    const { preferencesPage, workspacePage, preferencesPluginsPage } = user.pageManager;

    const actionLabel = 'Show Item Info';
    const dataPath = await appFlow.getDataPath();
    const pluginDir = path.join(dataPath, 'plugins', `insomnia-plugin-test`);
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.copyFileSync(path.join(import.meta.dirname, 'plugin-package.json'), path.join(pluginDir, 'package.json'));
    fs.copyFileSync(path.join(import.meta.dirname, 'plugin-main.js'), path.join(pluginDir, 'main.js'));
    await preferencesPluginsPage.reloadPlugins();

    const project = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));
    const collection = await workspaceFlow.createCollection(project, new Collection(faker.string.alphanumeric(10)));
    const requestName = faker.string.alphanumeric(10);
    await httpRequestFlow.create(collection, {
      name: requestName,
      method: HttpMethod.Get,
      url: `${HTTP_SERVER}/get`,
    } as HttpRequest);

    await workspacePage.clickItemContextMenu(requestName, actionLabel);
    const dialog = user.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    const dialogText = await dialog.innerText();

    expect(dialogText).toContain(requestName);
    expect(dialogText).toContain(HttpMethod.Get);
  },
);
