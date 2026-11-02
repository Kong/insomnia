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

test("Verify Environment Raw JSON Editor Reads Back And Persists Edits", async ({
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
  const environment = await environmentFlow.createBaseEnvironment(project, {
    name: faker.string.alphanumeric(10),
    kvPairData: [varA],
  });

  await environmentPage.selectEnvironment(environment.name);
  await environmentPage.toggleRawEdit();
  const rawBefore = await environmentPage.getRawJson();

  const newKey = faker.string.alphanumeric(8);
  const newValue = faker.string.alphanumeric(8);
  await environmentPage.setRawJson(JSON.stringify({ [newKey]: newValue }));

  await user.page.reload();
  await environmentPage.selectEnvironment(environment.name);
  const rawAfterReload = await environmentPage.getRawJson();

  expect(JSON.parse(rawBefore)).toEqual({ [varA.name]: varA.value });
  expect(JSON.parse(rawAfterReload)).toEqual({ [newKey]: newValue });
});
