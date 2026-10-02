import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { expect, test } from "../../misc/fixtures";
import type {
  EnvironmentKvPairData} from "../../models/environment";
import {
  EnvironmentKvPairDataType,
} from "../../models/environment";
import { Project } from "../../models/project";

test("Verify Disabling A Row In The Table Editor Is Reflected On Read-Back", async ({
  user,
}) => {
  const { environmentFlow, workspaceFlow } = user.flowManager;
  const { environmentPage } = user.pageManager;

  const project = await workspaceFlow.create(
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
  await environmentFlow.create(project, {
    name: faker.string.alphanumeric(10),
    kvPairData: [varA, varB],
  });

  await environmentPage
    .getRow(varA.name)
    .getByRole("button", { name: "Disable Row" })
    .click();
  const variables = await environmentPage.getVariables();

  expect(variables).toEqual([
    { ...varA, enabled: false },
    { ...varB, enabled: true },
  ]);
});
