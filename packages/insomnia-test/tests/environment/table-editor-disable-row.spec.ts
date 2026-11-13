import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import type {
  EnvironmentKvPairData} from "@package/models/environment";
import {
  EnvironmentKvPairDataType,
} from "@package/models/environment";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify Disabling A Row In The Table Editor Is Reflected On Read-Back", async ({
  user,
}) => {
  const { environmentFlow, workspaceFlow } = user.flowManager;
  const { environmentPage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const varA = {
    id: "",
    name: faker.string.alphanumeric(8),
    value: faker.string.alphanumeric(8),
    type: EnvironmentKvPairDataType.STRING,
    enabled: true,
  } satisfies EnvironmentKvPairData;
  const varB = {
    id: "",
    name: faker.string.alphanumeric(8),
    value: faker.string.alphanumeric(8),
    type: EnvironmentKvPairDataType.STRING,
    enabled: true,
  } satisfies EnvironmentKvPairData;
  await environmentFlow.createBaseEnvironment(project, {
    name: faker.string.alphanumeric(10),
    kvPairData: [varA, varB],
  });

  await environmentPage.disableRow(environmentPage.getRow(varA.name));
  const variables = await environmentPage.getVariables();

  expect(variables).toEqual([
    { ...varA, enabled: false },
    { ...varB, enabled: true },
  ]);
});
