import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { MockBodyType } from "../../enums/mock-body-type";
import { ProjectType } from "../../enums/project-types";
import { expect, MOCK_BIN_SERVER, test } from "../../misc/fixtures";
import { MockServer } from "../../models/mock-server";
import { Project } from "../../models/project";

test("Verify Edited Mock Route Status And Body Are Pushed To The Mock Server Without Testing", async ({
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
  const body = { [faker.string.alpha(6)]: faker.string.alphanumeric(10) };
  const route = await mockServerFlow.createRoute(server, {
    path: `/${faker.string.alphanumeric(8)}`,
    method: HttpMethod.Get,
    statusCode: 203,
    bodyType: MockBodyType.Json,
    body: JSON.stringify(body),
  });
  const url = await mockServerFlow.getUrl(route);

  await expect.poll(async () => (await fetch(url)).status).toBe(203);
  const served = await fetch(url);

  expect(url.startsWith(`${MOCK_BIN_SERVER}/bin/mock_`)).toBe(true);
  expect(url.endsWith(route.path)).toBe(true);
  expect(await served.json()).toEqual(body);
});

test("Verify Edited Mock Route Headers Are Pushed To The Mock Server Without Testing", async ({
  user,
}) => {
  test.fail();

  const { mockServerFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const server = await mockServerFlow.create(
    project,
    new MockServer(faker.string.alphanumeric(10), MOCK_BIN_SERVER),
  );
  const header = {
    name: `x-${faker.string.alpha(8).toLowerCase()}`,
    value: faker.string.alphanumeric(10),
  };
  const route = await mockServerFlow.createRoute(server, {
    path: `/${faker.string.alphanumeric(8)}`,
    headers: [header],
  });
  const url = await mockServerFlow.getUrl(route);

  await expect
    .poll(async () => (await fetch(url)).headers.get(header.name))
    .toBe(header.value);
});
