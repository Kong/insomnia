import path from "node:path";

import { faker } from "@faker-js/faker";

import { ProjectType } from "../../../../../enums/project-types";
import { expect, test } from "../../../../../misc/fixtures";
import { Project } from "../../../../../models/project";

test("Import Multiple Workspaces From Single File", async ({ user }) => {
  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const filePath = path.join(__dirname, "multiple-workspaces.yaml");
  await importFlow.importFile(project, filePath);

  const collection1 = await workspaceFlow.getCollection("Collection 1");
  const collection2 = await workspaceFlow.getCollection("Collection 2");
  const requestInCollection2 = await httpRequestFlow.get(
    "Request in collection 2",
  );

  expect(collection1).toBeDefined();
  expect(collection2).toBeDefined();
  expect(requestInCollection2).toBeDefined();
});
