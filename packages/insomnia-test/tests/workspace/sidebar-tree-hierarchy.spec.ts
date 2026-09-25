import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { TreeNodeType } from "../../enums/tree-node-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection, Info, Specification } from "../../models/collection";
import { Folder } from "../../models/folder";
import { Project } from "../../models/project";

test("Verify requests and folders render as nested child rows under a spec-carrying API Collection", async ({
  user,
}) => {
  const { workspaceFlow, folderFlow, httpRequestFlow } = user.flowManager;
  const { workspacePage, httpRequestPage } = user.pageManager;

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
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10), spec),
  );

  const folder = await folderFlow.create(
    collection,
    new Folder(faker.string.alphanumeric(10)),
  );
  const topLevelRequest = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });
  const nestedRequest = await httpRequestFlow.create(
    folder,
    {
      name: faker.string.alphanumeric(10),
      method: HttpMethod.Get,
      url: `${HTTP_SERVER}/get`,
    },
  );

  const collectionNode = await workspacePage.findItemNode(
    collection,
    TreeNodeType.Workspace,
  );
  const folderNode = await workspacePage.findItemNode(
    { name: folder.name, id: folder.id },
    TreeNodeType.Folder,
    collectionNode,
  );
  const nestedRequestNode = await workspacePage.findItemNode(
    { name: nestedRequest.name, id: nestedRequest.id },
    TreeNodeType.Request,
    folderNode,
  );
  await workspacePage.clickNode(nestedRequestNode!);
  await httpRequestPage.navigate();
  const nestedRequestOpenUrl = await httpRequestPage.getUrl();

  expect(
    collectionNode?.children.some((n) => n._id === folderNode?._id),
  ).toBe(true);
  expect(
    collectionNode?.children.some((n) => n._id === topLevelRequest.id),
  ).toBe(true);
  expect(
    folderNode?.children.some((n) => n._id === nestedRequestNode?._id),
  ).toBe(true);
  expect(
    collectionNode?.children.some((n) => n._id === nestedRequestNode?._id),
  ).toBe(false);
  expect(nestedRequestOpenUrl).toBe(nestedRequest.url);
});
