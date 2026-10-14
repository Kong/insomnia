import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ProjectType } from "../../enums/project-types";
import { MOCK_BIN_SERVER, test } from "../../misc/fixtures";
import { MockServer } from "../../models/mock-server";
import { Project } from "../../models/project";

test("Verify Testing A Default Mock Route Returns 200 With No Body", async ({
  user,
}) => {
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
  const responseView = await mockServerFlow.test(route);

  expect(responseView.statusCode).toBe(200);
  expect(responseView.body).toBeUndefined();
});
