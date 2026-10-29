import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { DEFAULT_TIMEOUT, HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Folder } from "../../models/folder";
import { Project } from "../../models/project";

test("Verify Deleting a Request, Folder and Collection With Open Tabs via the Delete Shortcut and Context Menu Closes the Dialog Without a Resource-Not-Found Toast", async ({
  user,
}) => {
  const { workspaceFlow, folderFlow, httpRequestFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const shortcutCollection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const menuCollection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const shortcutFolder = await folderFlow.create(
    shortcutCollection,
    new Folder(faker.string.alphanumeric(10)),
  );
  const menuFolder = await folderFlow.create(
    shortcutCollection,
    new Folder(faker.string.alphanumeric(10)),
  );
  const shortcutRequest = await httpRequestFlow.create(shortcutCollection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });
  const menuRequest = await httpRequestFlow.create(shortcutCollection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });
  const shortcutCollectionRequest = await httpRequestFlow.create(
    shortcutCollection,
    {
      name: faker.string.alphanumeric(10),
      method: HttpMethod.Get,
      url: `${HTTP_SERVER}/get`,
    },
  );
  const menuCollectionRequest = await httpRequestFlow.create(menuCollection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });

  await workspaceFlow.deleteViaShortcut(shortcutRequest);
  await workspaceFlow.delete(menuRequest);
  await workspaceFlow.deleteViaShortcut(shortcutFolder);
  await workspaceFlow.delete(menuFolder);
  await workspaceFlow.deleteViaShortcut(shortcutCollection);
  await workspaceFlow.delete(menuCollection);

  const remainingNames = (await workspacePage.getNodes()).map(
    (node) => node.name,
  );
  const remainingNamesSet = new Set(remainingNames);

  expect(
    [
      shortcutRequest.name,
      menuRequest.name,
      shortcutFolder.name,
      menuFolder.name,
      shortcutCollection.name,
      menuCollection.name,
    ].filter((name) => remainingNamesSet.has(name)),
  ).toEqual([]);
  await expect
    .poll(
      async () => [
        await workspacePage.isTabOpen(shortcutRequest.name),
        await workspacePage.isTabOpen(menuRequest.name),
        await workspacePage.isTabOpen(shortcutCollectionRequest.name),
        await workspacePage.isTabOpen(menuCollectionRequest.name),
      ],
      { timeout: DEFAULT_TIMEOUT },
    )
    .toEqual([false, false, false, false]);
  expect(await workspacePage.countResourceNotFoundToasts()).toBe(0);
});
