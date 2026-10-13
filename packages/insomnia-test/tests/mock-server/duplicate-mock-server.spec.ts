import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { expect, MOCK_BIN_SERVER, test } from "../../misc/fixtures";
import { MockServer } from "../../models/mock-server";
import { Project } from "../../models/project";

test("Verify Duplicating A Mock Server Keeps Its Routes", async ({ user }) => {
  const { mockServerFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const server = await mockServerFlow.create(
    project,
    new MockServer(faker.string.alphanumeric(10), MOCK_BIN_SERVER),
  );
  const route = await mockServerFlow.createRoute(server, {
    path: `/${faker.string.alphanumeric(8)}`,
  });
  const copy = await mockServerFlow.duplicate(
    server,
    faker.string.alphanumeric(10),
  );
  const copyRoutePaths = await mockServerFlow.getRoutePaths(copy);

  expect(copy.id).not.toBe(server.id);
  expect(copyRoutePaths).toEqual([route.path]);
});
