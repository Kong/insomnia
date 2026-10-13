import * as os from "node:os";
import path from "node:path";

import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { waitForExportedFile } from "../../misc/export-file";
import { expect, MOCK_BIN_SERVER, test } from "../../misc/fixtures";
import { MockServer } from "../../models/mock-server";
import { Project } from "../../models/project";

test("Verify Exported Mock Server Can Be Imported Into Another Project", async ({
  user,
}) => {
  const { importFlow, mockServerFlow, workspaceFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

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

  const filePath = path.join(
    os.tmpdir(),
    `${faker.string.alphanumeric(10)}.yaml`,
  );
  await mockServerFlow.export(server, filePath);
  const exported = await waitForExportedFile(filePath);

  const targetProject = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  await importFlow.importFile(targetProject, filePath);
  const nodes = await workspacePage.getNodes();
  const importedNode = nodes.find(
    (node) => node.name === server.name && node._id !== server.id,
  );
  const importedRoutePaths = await mockServerFlow.getRoutePaths(
    await mockServerFlow.get({ name: server.name, id: importedNode?._id }),
  );

  expect(exported).toContain(MOCK_BIN_SERVER);
  expect(exported).toContain(route.path);
  expect(importedNode).toBeDefined();
  expect(importedRoutePaths).toEqual([route.path]);
});
