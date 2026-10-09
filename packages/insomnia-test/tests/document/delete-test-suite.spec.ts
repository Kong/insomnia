import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { expect, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Deleting A Test Suite Via Its Confirm Modal", async ({ user }) => {
  const { workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const collection = await workspaceFlow.create(
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
