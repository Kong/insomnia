import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { DEFAULT_TIMEOUT,expect, test, WS_SERVER } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const webSocketUrl = WS_SERVER;

test("Verify Create WebSocket Request", async ({ user }) => {
  const { webSocketRequestFlow, workspaceFlow } = user.flowManager;
  const { responsePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const request = await webSocketRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: webSocketUrl,
  });
  await webSocketRequestFlow.send(request);
  const response = await webSocketRequestFlow.disconnect(request, async () => {
    const events = await responsePage.getEvents();
    expect(
      events?.some((event) => event.data.includes("Request served by")),
    ).toBeTruthy();
  });

  expect(response.headers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: "upgrade", value: "websocket" }),
      expect.objectContaining({ name: "connection", value: "Upgrade" }),
    ]),
  );
  await expect
    .poll(() => response.console?.(), { timeout: DEFAULT_TIMEOUT })
    .toContain("101 Switching Protocols");
  await expect
    .poll(
      async () =>
        (await response.events?.())?.some((event) =>
          event.data.includes("Connected successfully"),
        ),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeTruthy();
  await expect
    .poll(
      async () =>
        (await response.events?.())?.some((event) =>
          event.data.includes("Disconnected"),
        ),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeTruthy();
});
