import path from "node:path";

import { faker } from "@faker-js/faker";

import { ProjectType } from "../../../../../enums/project-types";
import { expect, test } from "../../../../../misc/fixtures";
import { Project } from "../../../../../models/project";

test("Import OpenAPI Spec by File", async ({ user }) => {
  const { importFlow, workspaceFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const filePath = path.join(__dirname, "httpbingo-get.json");
  await importFlow.importFile(project, filePath);

  const nodes = await workspacePage.getNodes();
  expect(nodes.map((n) => n.name)).toContain("HTTPBingo Sample 1.0.0");
});
