import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { MOCK_BIN_SERVER, test } from "@package/misc/fixtures";
import { MockServer } from "@package/models/mock-server";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify Duplicating A Mock Server Keeps Its Routes", async ({ user }) => {
  const { mockServerFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
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
