import fs from "node:fs";
import path from "node:path";

import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Import OpenAPI Spec by Clipboard (JSON)", async ({ user }) => {
  const { importFlow, workspaceFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const content = fs.readFileSync(
    path.join(import.meta.dirname, "httpbingo-get.json"),
    "utf8",
  );
  await importFlow.importClipboard(project, content);

  const nodes = await workspacePage.getNodes();
  expect(nodes.map((n) => n.name)).toContain("HTTPBingo Sample 1.0.0");
});

test("Import OpenAPI Spec by Clipboard (YAML)", async ({ user }) => {
  const { importFlow, workspaceFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const content = fs.readFileSync(
    path.join(import.meta.dirname, "httpbingo-get.yaml"),
    "utf8",
  );
  await importFlow.importClipboard(project, content);

  const nodes = await workspacePage.getNodes();
  expect(nodes.map((n) => n.name)).toContain("HTTPBingo Sample YAML 1.0.0");
});
