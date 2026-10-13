import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import {
  DEFAULT_TIMEOUT,
  expect,
  SOCKET_SERVER_AUTH_TOKEN,
  SOCKET_SERVER_PROTECTED,
  test,
} from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Socket.IO Handshake Is Accepted With the Token and Rejected Without It", async ({
  user,
}) => {
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
    url: SOCKET_SERVER_PROTECTED,
    authentication: {
      type: "singleToken",
      token: SOCKET_SERVER_AUTH_TOKEN,
    },
  });
  await socketIoRequestFlow.connect(request);
  const authenticatedResponse = await socketIoRequestFlow.disconnect(request);

  await expect
    .poll(
      async () =>
        (await authenticatedResponse.events?.())?.map((event) => event.data),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toContain("Connected successfully");


  const unauthenticatedRequest = await socketIoRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: SOCKET_SERVER_PROTECTED,
  });
  await expect(
    socketIoRequestFlow.connect(unauthenticatedRequest),
  ).rejects.toThrow();

  await expect
    .poll(() => responsePage.getConsole(), { timeout: DEFAULT_TIMEOUT })
    .toContain("unauthorized");
});
