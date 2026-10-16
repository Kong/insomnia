import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import {
  DEFAULT_TIMEOUT,
  expect,
  SOCKET_SERVER,
  test,
} from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Disconnecting a Socket.IO Request Before the Server Replies Delivers No Echo", async ({
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

  const payload = faker.string.alphanumeric(12);
  const request = await socketIoRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: SOCKET_SERVER,
    headers: [{ name: "x-reply-delay-ms", value: "10000" }],
    message: { eventName: "hello", payload: `"${payload}"` },
  });
  await socketIoRequestFlow.connect(request);
  await socketIoRequestFlow.sendMessage(request);
  const disconnectResponse = await socketIoRequestFlow.disconnect(request);

  await expect
    .poll(
      async () =>
        (await disconnectResponse.events?.())?.some((event) =>
          event.data.includes("Disconnected"),
        ),
      {
        timeout: DEFAULT_TIMEOUT,
      },
    )
    .toBeTruthy();
  const eventsAfterDisconnect = (await disconnectResponse.events?.()) ?? [];

  await socketIoRequestFlow.connect(request);
  
  const reconnectResponse = await socketIoRequestFlow.disconnect(request);

  expect(
    eventsAfterDisconnect.filter((event) => event.data.includes(payload)),
  ).toHaveLength(1);
  await expect
    .poll(
      async () =>
        (await reconnectResponse.events?.())?.some((event) =>
          event.data.includes("Connected successfully"),
        ),
      {
        timeout: DEFAULT_TIMEOUT,
      },
    )
    .toBeTruthy();
});
