import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { expect, SOCKET_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const message = { eventName: "hello", payload: '"world"' };

test("Verify Duplicated Socket.IO Request Keeps Url and Message", async ({
  user,
}) => {
  const { socketIoRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const request = await socketIoRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: SOCKET_SERVER,
    message,
  });
  const duplicatedName = `${request.name} (Copy)`;
  await workspaceFlow.duplicate(request, duplicatedName);

  const duplicated = await socketIoRequestFlow.get(duplicatedName);

  expect(duplicated).toBeTruthy();
  expect(duplicated!.url).toBe(request.url);
  expect(duplicated!.message).toEqual(message);
});
