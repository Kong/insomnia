import * as fs from "node:fs";
import * as path from "node:path";

import { faker } from "@faker-js/faker";

import { ProjectType } from "../../../enums/project-types";
import { expect, test } from "../../../misc/fixtures";
import { Project } from "../../../models/project";

const UNIT_TEST_FIXTURE = fs.readFileSync(
  path.join(__dirname, "unit-test.yaml"),
  "utf8",
);

const DOCUMENT_NAME = "unit-test-fixture";
const TEST_SUITE_NAME = "Existing Test Suite";

test("Verify Unit Test Suite Run Results And Suite/Test Renaming", async ({
  user,
}) => {
  const { workspaceFlow, importFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importClipboard(project, UNIT_TEST_FIXTURE);

  const suite = await workspaceFlow.getTestSuite(
    DOCUMENT_NAME,
    TEST_SUITE_NAME,
  );
  const { summary: resultSummary, rows: resultRows } =
    await workspaceFlow.runAllTests(suite);

  const test = faker.string.alphanumeric(10);
  await workspaceFlow.createUnitTest(suite, test);
  const updatedSuite = await workspaceFlow.getTestSuite(
    DOCUMENT_NAME,
    TEST_SUITE_NAME,
  );

  expect(resultSummary).toMatch(/Tests passed/);
  expect(resultSummary).toMatch(/2\/2/);
  expect(resultRows).toEqual([
    { title: "Request A is found", passed: true },
    { title: "Request B is not found", passed: true },
  ]);
  expect(suite.name).toBe(TEST_SUITE_NAME);
  expect(suite.collection.name).toBe(DOCUMENT_NAME);
  expect(
    updatedSuite.tests.some((unitTest) => unitTest.name.includes(test)),
  ).toBe(true);
});
