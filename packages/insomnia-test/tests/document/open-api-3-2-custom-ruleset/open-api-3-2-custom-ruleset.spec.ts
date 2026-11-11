import { readFileSync } from "node:fs";
import path from "node:path";

import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify A Custom Spectral Ruleset Extending spectral:oas Reports No Example Errors For An OpenAPI 3.2 dataValue Example", async ({
  user,
}) => {
  test.fail(true, "INS-4299");

  const { workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await workspaceFlow.createCollection(
    project,
    new Collection(
      faker.string.alphanumeric(10),
      JSON.stringify(
        JSON.parse(
          readFileSync(
            path.join(import.meta.dirname, "data-value-example-3.2.json"),
            "utf8",
          ),
        ),
      ),
    ),
  );
  await workspaceFlow.uploadRuleset(
    path.join(import.meta.dirname, "custom.spectral.yaml"),
    "require-x-test-marker",
  );
  const lint = await workspaceFlow.getLintState();

  expect(lint.entries.map((entry) => entry.code)).toEqual([
    "require-x-test-marker",
  ]);
  expect(lint.errors).toBe(1);
  expect(lint.warnings).toBe(0);
});
