import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";

test("Verify Deleting A Test Suite Via Its Confirm Modal", async ({ user }) => {
  const { workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const suite = faker.string.alphanumeric(10);
  await workspaceFlow.createTestSuite(collection, suite);
  const suiteNamesBeforeDelete =
    await workspaceFlow.getTestSuiteNames(collection);

  await workspaceFlow.deleteTestSuite(collection, suite);
  const suiteNamesAfterDelete =
    await workspaceFlow.getTestSuiteNames(collection);

  expect(
    suiteNamesBeforeDelete.some((name) => name.includes(suite)),
  ).toBe(true);
  expect(suiteNamesAfterDelete.some((name) => name.includes(suite))).toBe(
    false,
  );
});
