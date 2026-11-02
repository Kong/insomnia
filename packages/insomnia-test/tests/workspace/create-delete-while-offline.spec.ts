import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { HTTP_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";

test("Verify collection/request create and delete persist correctly while offline", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collectionA = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const requestA = await httpRequestFlow.create(collectionA, {
    name: faker.string.alphanumeric(10),
    url: `${HTTP_SERVER}/get`,
    method: HttpMethod.Get,
  });

  await user.page.context().setOffline(true);

  const collectionB = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const requestB = await httpRequestFlow.create(collectionB, {
    name: faker.string.alphanumeric(10),
    url: `${HTTP_SERVER}/get`,
    method: HttpMethod.Get,
  });
  await workspaceFlow.delete(requestA);

  await user.page.reload({ waitUntil: "networkidle" });

  const gotCollectionA = await workspaceFlow.getCollection(collectionA.name);
  const gotRequestA = await httpRequestFlow.get(requestA.name);
  const gotCollectionB = await workspaceFlow.getCollection(collectionB.name);
  const gotRequestB = await httpRequestFlow.get(requestB.name);

  expect(gotCollectionA).toBeDefined();
  expect(gotRequestA).toBeUndefined();
  expect(gotCollectionB).toBeDefined();
  expect(gotRequestB?.url).toBe(requestB.url);
  expect(gotRequestB?.method).toBe(requestB.method);
});