import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { MockBodyType } from "../../enums/mock-body-type";
import { ProjectType } from "../../enums/project-types";
import { expect, MOCK_BIN_SERVER, test } from "../../misc/fixtures";
import { MockServer } from "../../models/mock-server";
import { Project } from "../../models/project";

test("Verify Mock Route Response Definition Is Returned By Test", async ({
  user,
}) => {
  const { mockServerFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
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

  expect(responseView.statusCode).toBe(201);
  expect(responseView.statusMessage).toBe(statusText);
  expect(responseView.body).toEqual(body);
  expect(responseView.headers).toEqual(
    expect.arrayContaining([expect.objectContaining(header)]),
  );
});
