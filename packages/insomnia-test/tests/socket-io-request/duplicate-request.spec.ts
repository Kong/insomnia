import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ProjectType } from "@package/enums/project-types";
import { SOCKET_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";

const message = { eventName: "hello", payload: '"world"' };

test("Verify Duplicated Socket.IO Request Keeps Url and Message", async ({
  user,
}) => {
  const { socketIoRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const request = await socketIoRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: SOCKET_SERVER,
    message,
  });
  const duplicatedName = `${request.name} (Copy)`;
  await workspaceFlow.duplicateRequest(request, duplicatedName);

  const duplicated = await socketIoRequestFlow.get(duplicatedName);

  expect(duplicated).toBeTruthy();
  expect(duplicated!.url).toBe(request.url);
  expect(duplicated!.message).toEqual(message);
});
