import { faker } from "@faker-js/faker";

import { ContentType } from "../../enums/content-type";
import { ProjectType } from "../../enums/project-types";
import { DEFAULT_TIMEOUT,expect, test, WS_SERVER } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const webSocketUrl = WS_SERVER;

test("Send Multiple Messages of Different Body Types Over an Open WebSocket Connection", async ({
  user,
}) => {
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

  const jsonMessage = JSON.stringify({
    greeting: faker.string.alphanumeric(8),
  });
  await webSocketRequestFlow.sendMessage(
    request,
    { contentType: ContentType.JSON, content: jsonMessage },
    async () => {
      const events = await responsePage.getEvents();
      expect(
        events?.some((event) => event.data.includes(jsonMessage)),
      ).toBeTruthy();
    },
  );

  const rawMessage = `raw-${faker.string.alphanumeric(8)}`;
  await webSocketRequestFlow.sendMessage(
    request,
    { contentType: ContentType.Plain, content: rawMessage },
    async () => {
      const events = await responsePage.getEvents();
      expect(
        events?.some((event) => event.data.includes(rawMessage)),
      ).toBeTruthy();
    },
  );
  const response = await webSocketRequestFlow.disconnect(request);
  await expect
    .poll(
      async () =>
        (await response.events?.())?.filter((event) =>
          event.data.includes(jsonMessage),
        ).length,
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeGreaterThan(0);
  await expect
    .poll(
      async () =>
        (await response.events?.())?.filter((event) =>
          event.data.includes(rawMessage),
        ).length,
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeGreaterThan(0);
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
