import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { MOCK_BIN_SERVER, MOCK_BIN_SOURCE_RESPONSE, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { MockServer } from "../../models/mock-server";
import { Project } from "../../models/project";

test("Verify Creating A Mock Route From A Request Response", async ({
  user,
}) => {
  const { httpRequestFlow, mockServerFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const server = await mockServerFlow.create(
    project,
    new MockServer(faker.string.alphanumeric(10), MOCK_BIN_SERVER),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: MOCK_BIN_SOURCE_RESPONSE.url,
  });
  await httpRequestFlow.send(request);
  const route = await mockServerFlow.createRouteFromResponse(
    server,
    `/${faker.string.alphanumeric(8)}`,
  );
  const routePaths = await mockServerFlow.getRoutePaths(server);
  const responseView = await mockServerFlow.test(route);

  expect(routePaths).toEqual([route.path]);
  expect(responseView.statusCode).toBe(MOCK_BIN_SOURCE_RESPONSE.statusCode);
  expect(responseView.body).toEqual(MOCK_BIN_SOURCE_RESPONSE.body);
  expect(responseView.headers).toEqual(
    expect.arrayContaining([
      expect.objectContaining(MOCK_BIN_SOURCE_RESPONSE.header),
    ]),
  );
});
