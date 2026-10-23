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

test("Verify Template Tag in Socket.IO Message Payload Is Resolved", async ({
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
    message: {
      eventName: "hello",
      payload: JSON.stringify("{% base64 'encode', 'normal', 'abc' %}"),
    },
  });
  await socketIoRequestFlow.connect(request);
  const sendResponse = await socketIoRequestFlow.sendMessage(request);
  await socketIoRequestFlow.disconnect(request);

  await expect
    .poll(
      async () =>
        (await sendResponse.events?.())?.some(
          (event) => event.data === "hello\nYWJj",
        ),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeTruthy();
});
