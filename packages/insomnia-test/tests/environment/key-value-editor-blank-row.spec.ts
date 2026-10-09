import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { expect, test } from "../../misc/fixtures";
import type {
  EnvironmentKvPairData} from "../../models/environment";
import {
  EnvironmentKvPairDataType,
} from "../../models/environment";
import { Project } from "../../models/project";

test("Verify Environment Table Editor's Blank Row Is Not Persisted And Deleting A Row Leaves No Stale Text", async ({
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
  const varC = {
    id: "",
    name: faker.string.alphanumeric(8),
    value: faker.string.alphanumeric(8),
    type: EnvironmentKvPairDataType.STRING,
    enabled: true,
  } satisfies EnvironmentKvPairData;
  const environment = await environmentFlow.create(project, {
    name: faker.string.alphanumeric(10),
    kvPairData: [varA, varB, varC],
  });
  const beforeDelete = await environmentFlow.get(environment.name);

  await environmentPage.deleteRow(environmentPage.getRow(varB.name));

  const afterDelete = await environmentFlow.get(environment.name);

  expect(beforeDelete?.kvPairData).toEqual([varA, varB, varC]);
  expect(afterDelete?.kvPairData).toEqual([varA, varC]);
});
