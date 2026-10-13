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

test("Verify WebSocket Connection Sends the Bearer Token Header Until Authentication Is Set to None", async ({
  user,
}) => {
  const { webSocketRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const token = faker.string.alphanumeric(20);
  const request = await webSocketRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: WS_SERVER,
    authentication: { type: "bearer", token },
  });
  await webSocketRequestFlow.send(request);
  const authenticatedResponse = await webSocketRequestFlow.disconnect(request);

  await expect
    .poll(() => authenticatedResponse.console?.(), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toContain(`authorization: Bearer ${token}`);

  await webSocketRequestFlow.setAuthentication(request, { type: "none" });
  await webSocketRequestFlow.send(request);
  const unauthenticatedResponse =
    await webSocketRequestFlow.disconnect(request);

  await expect
    .poll(() => unauthenticatedResponse.console?.(), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toContain("host:");
  expect(await unauthenticatedResponse.console?.()).not.toContain(
    "authorization:",
  );
});
