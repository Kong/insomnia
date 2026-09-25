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
import type { SocketIORequest } from "../../models/socket-io-request";

const socketIoUrl = SOCKET_SERVER;
const message = { eventName: "hello", payload: '"world"' };

test("Verify Create Socket.IO Request", async ({ user }) => {
  test.fail(true, "INS-3123");

  const { socketIoRequestFlow, workspaceFlow } = user.flowManager;
  const { responsePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const request = await socketIoRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: socketIoUrl,
    message,
  });
  await socketIoRequestFlow.connect(request);
  const sendResponse = await socketIoRequestFlow.sendMessage(request);
  await expect
    .poll(
      async () =>
        (await sendResponse.events?.())?.some((event) =>
          event.data.includes("hello"),
        ),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeTruthy();

  const disconnectResponse = await socketIoRequestFlow.disconnect(
    request,
    async () => {
      const events = await responsePage.getEvents();
      expect(
        events?.some((event) => event.data.includes("world")),
      ).toBeTruthy();
    },
  );
  await expect
    .poll(
      async () =>
        (await disconnectResponse.events?.())?.some((event) =>
          event.data.includes("Disconnected"),
        ),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeTruthy();

  const duplicatedCollection = await workspaceFlow.duplicate(
    collection,
    `${collection.name} (Copy)`,
  );
  const duplicatedRequest = (await workspaceFlow.get<SocketIORequest>(
    request.name,
    duplicatedCollection,
  ))!;

  expect(duplicatedRequest.url).toBe(request.url);
  expect(duplicatedRequest.message).toEqual(message);

  await socketIoRequestFlow.connect(duplicatedRequest);
  const duplicatedSendResponse =
    await socketIoRequestFlow.sendMessage(duplicatedRequest);
  await expect
    .poll(
      async () =>
        (await duplicatedSendResponse.events?.())?.some((event) =>
          event.data.includes("hello"),
        ),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeTruthy();

  const duplicatedDisconnectResponse = await socketIoRequestFlow.disconnect(
    duplicatedRequest,
    async () => {
      const events = await responsePage.getEvents();
      expect(
        events?.some((event) => event.data.includes("world")),
      ).toBeTruthy();
    },
  );
  await expect
    .poll(
      async () =>
        (await duplicatedDisconnectResponse.events?.())?.some((event) =>
          event.data.includes("Disconnected"),
        ),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeTruthy();
});
