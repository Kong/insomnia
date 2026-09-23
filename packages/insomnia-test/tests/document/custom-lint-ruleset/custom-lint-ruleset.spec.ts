import path from "node:path";

import { faker } from "@faker-js/faker";

import { ProjectType } from "../../../enums/project-types";
import { RulesetType } from "../../../enums/ruleset-type";
import { expect, test } from "../../../misc/fixtures";
import { Collection } from "../../../models/collection";
import { Project } from "../../../models/project";

const VALID_RULESET = path.join(__dirname, "custom.spectral.yaml");
const INVALID_RULESET = path.join(__dirname, "invalid.spectral.yaml");

test("Verify Custom Spectral Ruleset Upload, Removal, And Rejection Of An Invalid Ruleset", async ({
  user,
}) => {
  test.fail(true, "INS-3469");

  const { workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const collection = await workspaceFlow.create(
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

  await workspaceFlow.uploadRuleset(INVALID_RULESET);
  const afterInvalidUpload = await workspaceFlow.getCollectionSpec(collection);

  expect(collection.rulesetType).toBe(RulesetType.Default);
  expect(lintAfterCreate).toEqual({ errors: 0, warnings: 0, codes: [] });
  expect(customRulesetCodes).toContain("require-x-test-marker");
  expect(afterRemove?.rulesetType).toBe(RulesetType.Default);
  expect(lintAfterRemove).toEqual({ errors: 0, warnings: 0, codes: [] });
  expect(afterInvalidUpload?.rulesetType).toBe(RulesetType.Default);
});
