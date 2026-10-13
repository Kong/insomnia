import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, MOCK_BIN_SERVER, test } from "../../misc/fixtures";
import { MockServer } from "../../models/mock-server";
import { Project } from "../../models/project";

test("Verify Mock Route History Logs Each Tested Request", async ({ user }) => {
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
    method: HttpMethod.Put,
  });
  const url = await mockServerFlow.getUrl(route);
  await mockServerFlow.test(route);
  await mockServerFlow.test(route);
  const history = await mockServerFlow.getHistory(route);

  expect(history).toHaveLength(2);
  expect(history).toEqual([
    { method: HttpMethod.Put, url },
    { method: HttpMethod.Put, url },
  ]);
});
