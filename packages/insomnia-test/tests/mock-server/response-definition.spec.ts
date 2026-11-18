import { faker } from "@faker-js/faker";
import { HttpMethod } from "@package/enums/http-method";
import { MockBodyType } from "@package/enums/mock-body-type";
import { ProjectType } from "@package/enums/project-types";
import { MOCK_BIN_SERVER, test } from "@package/misc/fixtures";
import { MockServer } from "@package/models/mock-server";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify Mock Route Response Definition Is Returned By Test", async ({
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
  const statusText = faker.string.alpha(8);
  const header = {
    name: `x-${faker.string.alpha(8).toLowerCase()}`,
    value: faker.string.alphanumeric(10),
  };
  const body = { [faker.string.alpha(6)]: faker.string.alphanumeric(10) };
  const route = await mockServerFlow.createRoute(server, {
    path: `/${faker.string.alphanumeric(8)}`,
    method: HttpMethod.Post,
    statusCode: 201,
    statusText,
    bodyType: MockBodyType.Json,
    body: JSON.stringify(body),
    headers: [header],
  });
  const responseView = await mockServerFlow.test(route);

  expect(responseView.statusBar.code).toBe(201);
  expect(responseView.statusBar.message).toBe(statusText);
  expect(responseView.preview).toEqual(body);
  expect(responseView.headers).toEqual(
    expect.arrayContaining([expect.objectContaining(header)]),
  );
});
