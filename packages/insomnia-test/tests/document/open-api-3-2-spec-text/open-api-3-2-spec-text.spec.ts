import { readFileSync } from "node:fs";
import path from "node:path";

import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify Reopening A Collection Keeps The OpenAPI 3.2 Spec Text Unchanged", async ({
  user,
}) => {
  const { specFlow, workspaceFlow } = user.flowManager;
  const specText = readFileSync(
    path.join(import.meta.dirname, "valid-3.2.json"),
    "utf8",
  );

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10), specText),
  );
  const before = await specFlow.getSpecText();
  await workspaceFlow.getCollectionSpec(collection);
  const after = await specFlow.getSpecText();
  const version = await specFlow.getOpenApiVersion();

  expect(before).toBe(specText);
  expect(after).toBe(specText);
  expect(version).toBe("OpenAPI 3.2.0");
  expect(after).toContain('"$self"');
  expect(after).toContain('"additionalOperations"');
  expect(after).toContain('"dataValue"');
});

test("Verify Reopening A Collection Keeps The OpenAPI 3.2 YAML Spec Text Unchanged", async ({
  user,
}) => {
  const { specFlow, workspaceFlow } = user.flowManager;
  const specText = readFileSync(
    path.join(import.meta.dirname, "valid-3.2.yaml"),
    "utf8",
  );

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10), specText),
  );
  const before = await specFlow.getSpecText();
  await workspaceFlow.getCollectionSpec(collection);
  const after = await specFlow.getSpecText();
  const version = await specFlow.getOpenApiVersion();

  expect(before).toBe(specText);
  expect(after).toBe(specText);
  expect(version).toBe("OpenAPI 3.2.0");
  expect(after).toContain("$self:");
  expect(after).toContain("additionalOperations:");
  expect(after).toContain("dataValue:");
});
