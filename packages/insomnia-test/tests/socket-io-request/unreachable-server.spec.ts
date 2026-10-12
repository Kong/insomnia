import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { DEFAULT_TIMEOUT, expect, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Connecting to an Unreachable Socket.IO Server Fails", async ({
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
    url: "ws://localhost:1",
  });

  await expect(socketIoRequestFlow.connect(request)).rejects.toThrow();
  await expect
    .poll(() => responsePage.getConsole(), { timeout: DEFAULT_TIMEOUT })
    .toContain("xhr poll error");
});
