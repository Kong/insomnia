import { faker } from "@faker-js/faker";

import { ContentType } from "../../enums/content-type";
import { ProjectType } from "../../enums/project-types";
import {
  DEFAULT_TIMEOUT,
  expect,
  test,
  WS_SERVER,
} from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Disconnecting a WebSocket Request Before the Server Replies Delivers No Echo", async ({
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

  const payload = faker.string.alphanumeric(12);
  const request = await webSocketRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: WS_SERVER,
    headers: [{ name: "x-reply-delay-ms", value: "10000" }],
  });
  await webSocketRequestFlow.send(request);
  await webSocketRequestFlow.sendMessage(request, {
    contentType: ContentType.Plain,
    content: payload,
  });
  const disconnectResponse = await webSocketRequestFlow.disconnect(request);

  await expect
    .poll(
      async () =>
        (await disconnectResponse.events?.())?.some((event) =>
          event.data.includes("Disconnected"),
        ),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeTruthy();
  const eventsAfterDisconnect = (await disconnectResponse.events?.()) ?? [];

  await webSocketRequestFlow.send(request);

  expect(
    eventsAfterDisconnect.filter((event) => event.data.includes(payload)),
  ).toHaveLength(1);
  expect(
    eventsAfterDisconnect.some((event) =>
      event.data.includes("Request served by"),
    ),
  ).toBeFalsy();
  await expect
    .poll(
      async () =>
        (await responsePage.getEvents())?.some((event) =>
          event.data.includes("Connected successfully"),
        ),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeTruthy();
});
