import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify collection/request create and delete persist correctly while offline", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collectionA = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const requestA = await httpRequestFlow.create(collectionA, {
    name: faker.string.alphanumeric(10),
    url: `${HTTP_SERVER}/get`,
    method: HttpMethod.Get,
  });

  await user.page.context().setOffline(true);

  const collectionB = await workspaceFlow.create(
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
  const gotRequestA = await httpRequestFlow.get(requestA.name, collectionA);
  const gotCollectionB = await workspaceFlow.getCollection(collectionB.name);
  const gotRequestB = await httpRequestFlow.get(requestB.name, collectionB);

  expect(gotCollectionA).toBeDefined();
  expect(gotRequestA).toBeUndefined();
  expect(gotCollectionB).toBeDefined();
  expect(gotRequestB?.url).toBe(requestB.url);
  expect(gotRequestB?.method).toBe(requestB.method);
});