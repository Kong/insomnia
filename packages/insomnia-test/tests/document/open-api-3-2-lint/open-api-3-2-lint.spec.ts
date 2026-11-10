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

test("Verify An OpenAPI 3.2 Spec With An Example Value Of The Wrong Type Lints Clean", async ({
  user,
}) => {
  const { specFlow, workspaceFlow } = user.flowManager;
  const { specPage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await workspaceFlow.createCollection(
    project,
    new Collection(
      faker.string.alphanumeric(10),
      readSpec("mismatched-example-value-3.2.json"),
    ),
  );
  const version = await specFlow.getOpenApiVersion();

  await expect
    .poll(() => specPage.getLintSummary(), { timeout: DEFAULT_TIMEOUT })
    .toBe("none");
  expect(version).toBe("OpenAPI 3.2.0");
});

test("Verify OpenAPI 3.2 Specs Breaking The querystring And additionalOperations Constraints Report oas3-schema Errors And Disable Generate Requests", async ({
  user,
}) => {
  const { specFlow, workspaceFlow } = user.flowManager;
  const { specPage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const fixtures = [
    "two-querystring-parameters-3.2.json",
    "querystring-with-query-parameter-3.2.json",
    "additional-operation-redefines-post-3.2.json",
  ];
  const results: {
    fixture: string;
    codes: string[];
    errors: number;
    generateEnabled: boolean;
  }[] = [];
  for (const fixture of fixtures) {
    await workspaceFlow.createCollection(
      project,
      new Collection(faker.string.alphanumeric(10), readSpec(fixture)),
    );
    await specPage.expandLintPanel();
    await expect
      .poll(() => specPage.getLintEntryCodes(), { timeout: DEFAULT_TIMEOUT })
      .toContain("oas3-schema");
    const summary = await specPage.getLintSummary();
    results.push({
      fixture,
      codes: await specPage.getLintEntryCodes(),
      errors: summary === "none" ? 0 : summary.errors,
      generateEnabled: await specFlow.isGenerateRequestsEnabled(),
    });
  }

  for (const result of results) {
    expect(result.codes).toContain("oas3-schema");
    expect(result.errors).toBeGreaterThan(0);
    expect(result.generateEnabled).toBe(false);
  }
});
