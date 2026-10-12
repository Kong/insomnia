import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import {
  DEFAULT_TIMEOUT,
  expect,
  test,
  WS_SERVER,
} from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Linked Cookie Is Sent With WebSocket Connection", async ({
  user,
}) => {
  const { cookieFlow, webSocketRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const request = await webSocketRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: WS_SERVER,
  });

  const cookieKey = faker.string.alphanumeric(8);
  const cookieValue = faker.string.alphanumeric(8);
  await cookieFlow.link(request, [
    { key: cookieKey, value: cookieValue, domain: "localhost", path: "/" },
  ]);

  await webSocketRequestFlow.send(request);
  const response = await webSocketRequestFlow.disconnect(request);

  await expect
    .poll(() => response.console?.(), { timeout: DEFAULT_TIMEOUT })
    .toContain(`cookie: ${cookieKey}=${cookieValue}`);
});
