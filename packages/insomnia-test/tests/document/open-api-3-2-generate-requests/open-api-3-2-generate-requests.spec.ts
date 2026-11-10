import { readFileSync } from "node:fs";
import path from "node:path";

import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { TreeNodeType } from "@package/enums/tree-node-types";
import { test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import type { TreeNode } from "@package/pages/workspace.page";
import { expect } from "@playwright/test";

const readSpec = (fileName: string) =>
  readFileSync(path.join(import.meta.dirname, fileName), "utf8");

const requestNames = (node: TreeNode): string[] =>
  node.children.flatMap((child) =>
    child.type === TreeNodeType.Request ? [child.name] : requestNames(child),
  );

test("Verify Generate Requests Works For A Valid OpenAPI 3.2 Spec And Matches An Import Of The Same Spec", async ({
  user,
}) => {
  const { importFlow, specFlow, workspaceFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10), readSpec("valid-3.2.json")),
  );
  const enabled = await specFlow.isGenerateRequestsEnabled();
  await specFlow.generateRequests();

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "valid-3.2.json"),
  );
  const nodes = (await workspacePage.getTree()).flatten();
  const generated = nodes.find(
    (node) =>
      node.type === TreeNodeType.Workspace && node.name === collection.name,
  )!;
  const imported = nodes.find(
    (node) =>
      node.type === TreeNodeType.Workspace && node.name === "Petstore 1.0.0",
  )!;

  expect(enabled).toBe(true);
  expect(requestNames(generated)).toHaveLength(3);
  expect(requestNames(generated).sort()).toEqual(requestNames(imported).sort());
});

test("Verify Generate Requests Is Enabled For A 3.1 Spec Whose Path Is A Path Item $ref", async ({
  user,
}) => {
  test.fail(true, "INS-4286");

  const { specFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await workspaceFlow.createCollection(
    project,
    new Collection(
      faker.string.alphanumeric(10),
      readSpec("path-item-ref-3.1.json"),
    ),
  );
  const enabled = await specFlow.isGenerateRequestsEnabled();

  expect(enabled).toBe(true);
});
