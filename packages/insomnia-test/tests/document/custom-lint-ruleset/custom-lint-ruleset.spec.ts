import path from "node:path";

import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { RulesetType } from "@package/enums/ruleset-type";
import { test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

const VALID_RULESET = path.join(import.meta.dirname, "custom.spectral.yaml");
const INVALID_RULESET = path.join(import.meta.dirname, "invalid.spectral.yaml");

// Rules from Spectral's built-in `oas` ruleset that a minimal OpenAPI spec
// (no servers / contact / descriptions / operationId / tags) always trips.
const DEFAULT_RULESET_WARNING_CODES = [
  "info-contact",
  "info-description",
  "oas3-api-servers",
  "operation-description",
  "operation-operationId",
  "operation-tags",
];

test("Verify Custom Spectral Ruleset Upload, Removal, And Rejection Of An Invalid Ruleset", async ({
  user,
}) => {
  const { workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(
      faker.string.alphanumeric(10),
      JSON.stringify({
        openapi: "3.0.0",
        info: { title: faker.commerce.productName(), version: "1.0.0" },
        paths: {
          [`/${faker.word.sample()}`]: {
            get: { responses: { "200": { description: "OK" } } },
          },
        },
      }),
    ),
  );

  const lintAfterCreate = await workspaceFlow.getLintState();

  const customRulesetCodes = await workspaceFlow.uploadRuleset(
    VALID_RULESET,
    "require-x-test-marker",
  );

  await workspaceFlow.removeRuleset(collection);
  const afterRemove = await workspaceFlow.getCollectionSpec(collection);
  const lintAfterRemove = await workspaceFlow.getLintState();

  await expect(workspaceFlow.uploadRuleset(INVALID_RULESET)).rejects.toThrow(
    /Invalid Spectral Ruleset/,
  );
  await workspaceFlow.closeDialog();
  const afterInvalidUpload = await workspaceFlow.getCollectionSpec(collection);

  expect(collection.rulesetType).toBe(RulesetType.Default);
  expect(lintAfterCreate.errors).toBe(0);
  expect(lintAfterCreate.entries.map((entry) => entry.code).sort()).toEqual(
    DEFAULT_RULESET_WARNING_CODES,
  );
  expect(customRulesetCodes).toContain("require-x-test-marker");
  expect(afterRemove?.rulesetType).toBe(RulesetType.Default);
  expect(lintAfterRemove.errors).toBe(0);
  expect(lintAfterRemove.entries.map((entry) => entry.code).sort()).toEqual(
    DEFAULT_RULESET_WARNING_CODES,
  );
  expect(afterInvalidUpload?.rulesetType).toBe(RulesetType.Default);
});

test("Verify Custom Spectral Ruleset Upload, Removal, And Rejection Of An Invalid Ruleset On A YAML Spec", async ({
  user,
}) => {
  const { workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(
      faker.string.alphanumeric(10),
      `openapi: 3.0.0
info:
  title: ${faker.commerce.productName()}
  version: 1.0.0
paths:
  /${faker.word.sample()}:
    get:
      responses:
        '200':
          description: OK
`,
    ),
  );

  const lintAfterCreate = await workspaceFlow.getLintState();

  const customRulesetCodes = await workspaceFlow.uploadRuleset(
    VALID_RULESET,
    "require-x-test-marker",
  );

  await workspaceFlow.removeRuleset(collection);
  const afterRemove = await workspaceFlow.getCollectionSpec(collection);
  const lintAfterRemove = await workspaceFlow.getLintState();

  await expect(workspaceFlow.uploadRuleset(INVALID_RULESET)).rejects.toThrow(
    /Invalid Spectral Ruleset/,
  );
  await workspaceFlow.closeDialog();
  const afterInvalidUpload = await workspaceFlow.getCollectionSpec(collection);

  expect(collection.rulesetType).toBe(RulesetType.Default);
  expect(lintAfterCreate.errors).toBe(0);
  expect(lintAfterCreate.entries.map((entry) => entry.code).sort()).toEqual(
    DEFAULT_RULESET_WARNING_CODES,
  );
  expect(customRulesetCodes).toContain("require-x-test-marker");
  expect(afterRemove?.rulesetType).toBe(RulesetType.Default);
  expect(lintAfterRemove.errors).toBe(0);
  expect(lintAfterRemove.entries.map((entry) => entry.code).sort()).toEqual(
    DEFAULT_RULESET_WARNING_CODES,
  );
  expect(afterInvalidUpload?.rulesetType).toBe(RulesetType.Default);
});
