import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, MOCK_BIN_SERVER, test } from "../../misc/fixtures";
import { MockServer } from "../../models/mock-server";
import { Project } from "../../models/project";

test("Verify Create, Edit and Delete Mock Routes", async ({ user }) => {
  const { mockServerFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const server = await mockServerFlow.create(
    project,
    new MockServer(faker.string.alphanumeric(10), MOCK_BIN_SERVER),
  );
  const first = await mockServerFlow.createRoute(server, {
    path: `/${faker.string.alphanumeric(8)}`,
  });
  const second = await mockServerFlow.createRoute(server, {
    path: `/${faker.string.alphanumeric(8)}`,
    method: HttpMethod.Post,
  });
  const pathsAfterCreate = await mockServerFlow.getRoutePaths(server);
  const edited = await mockServerFlow.editRoute(first, {
    path: `/${faker.string.alphanumeric(8)}`,
    method: HttpMethod.Put,
  });
  const openedRoute = await mockServerFlow.getRoute(edited);
  await mockServerFlow.deleteRoute(second);
  const pathsAfterDelete = await mockServerFlow.getRoutePaths(server);

  expect(pathsAfterCreate).toHaveLength(2);
  expect(pathsAfterCreate).toEqual(
    expect.arrayContaining([first.path, second.path]),
  );
  expect(openedRoute).toEqual({ method: HttpMethod.Put, path: edited.path });
  expect(pathsAfterDelete).toEqual([edited.path]);
});
