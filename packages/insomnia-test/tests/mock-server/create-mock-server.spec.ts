import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ProjectType } from "@package/enums/project-types";
import { MOCK_BIN_SERVER, test } from "@package/misc/fixtures";
import { MockServer } from "@package/models/mock-server";
import { Project } from "@package/models/project";

test("Verify Create Self-Hosted Mock Server", async ({ user }) => {
  const { mockServerFlow, workspaceFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const server = await mockServerFlow.create(
    project,
    new MockServer(faker.string.alphanumeric(10), MOCK_BIN_SERVER),
  );
  const routePaths = await mockServerFlow.getRoutePaths(server);
  const nodes = await workspacePage.getNodes();

  expect(server.id).toBeTruthy();
  expect(nodes.map((node) => node.name)).toContain(server.name);
  expect(routePaths).toEqual([]);
});
