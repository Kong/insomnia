import { readFileSync } from "node:fs";
import path from "node:path";

import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

const readSpec = (fileName: string) =>
  JSON.stringify(
    JSON.parse(readFileSync(path.join(import.meta.dirname, fileName), "utf8")),
  );

test("Verify A Valid OpenAPI 3.2 Spec Lints Clean With No Errors Or Warnings", async ({
  user,
}) => {
  const { specFlow, workspaceFlow } = user.flowManager;
  const { specPage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10), readSpec("valid-3.2.json")),
  );

  const version = await specFlow.getOpenApiVersion();

  await expect
    .poll(() => specPage.getLintSummary(), { timeout: DEFAULT_TIMEOUT })
    .toBe("none");
  expect(version).toBe("OpenAPI 3.2.0");
});

test("Verify A Structurally Invalid OpenAPI 3.2 Spec Still Reports Real Lint Errors", async ({
  user,
}) => {
  const { workspaceFlow } = user.flowManager;
  const { specPage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10), readSpec("invalid-3.2.json")),
  );
  await specPage.expandLintPanel();

  await expect
    .poll(() => specPage.getLintEntryCodes(), { timeout: DEFAULT_TIMEOUT })
    .toContain("oas3-schema");
  await expect
    .poll(
      async () => {
        const summary = await specPage.getLintSummary();
        return summary === "none" ? 0 : summary.errors;
      },
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeGreaterThan(0);
});
