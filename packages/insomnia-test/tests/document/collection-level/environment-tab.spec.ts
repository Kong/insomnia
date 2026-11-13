import path from "node:path";

import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import type { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

const FIXTURE = path.join(import.meta.dirname, "environment-tab.yaml");
const BASE = "Base Environment";
const SUB = "Sub Environment";

test("Environment tab edits the collection's base and sub-environments in place", async ({ user }) => {
  const { workspaceFlow, importFlow, collectionFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  await importFlow.importFile(project, FIXTURE);
  const collection = (await workspaceFlow.getCollection("Collection Environments")) as Collection;
  expect(collection).toBeTruthy();

  // 1. Edit a base variable and a sub-environment variable in the Environment tab.
  const tab = await collectionFlow.openEnvironmentTab(collection);
  expect(await tab.getEnvironmentNames()).toEqual([BASE, SUB]);
  await tab.selectEnvironment(BASE);
  await tab.setVariableValue("base_var", "base-edited-in-tab");
  await tab.selectEnvironment(SUB);
  await tab.setVariableValue("sub_var", "sub-edited-in-tab");

  // 2. The environment modal shows the same environments with the tab's edits.
  const modal = await collectionFlow.openEnvironmentModal(collection);
  expect(await modal.getEnvironmentNames()).toEqual([BASE, SUB]);
  await modal.selectEnvironment(BASE);
  expect(await modal.getVariables()).toContainEqual({ name: "base_var", value: "base-edited-in-tab" });
  await modal.selectEnvironment(SUB);
  expect(await modal.getVariables()).toContainEqual({ name: "sub_var", value: "sub-edited-in-tab" });

  // 3. And the other way round: an edit made in the modal shows up in the tab.
  await modal.selectEnvironment(BASE);
  await modal.setVariableValue("base_var", "base-edited-in-modal");
  await collectionFlow.closeEnvironmentModal();

  const reopened = await collectionFlow.openEnvironmentTab(collection);
  await reopened.selectEnvironment(BASE);
  expect(await reopened.getVariables()).toContainEqual({ name: "base_var", value: "base-edited-in-modal" });
});
