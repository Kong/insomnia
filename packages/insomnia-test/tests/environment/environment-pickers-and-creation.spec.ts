import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ProjectType } from "../../enums/project-types";
import { test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify the project and collection environment pickers open and close independently", async ({
  user,
}) => {
  const { workspaceFlow, environmentFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const openAfterCollection = await environmentFlow.getOpenPickersAfterOpening(collection, "collection");
  const openAfterProject = await environmentFlow.getOpenPickersAfterOpening(collection, "project");

  expect(openAfterCollection).toEqual(["collection"]);
  expect(openAfterProject).toEqual(["project"]);
});

test("Verify Add Project Environment from the picker lists the new environment without selecting it", async ({
  user,
}) => {
  const { workspaceFlow, environmentFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const environmentName = faker.string.alphanumeric(10);
  const pickerState = await environmentFlow.addProjectEnvironmentFromPicker(collection, environmentName);

  expect(pickerState.selected).toContain("No Project Environment");
  expect(pickerState.options.some((option) => option.includes(environmentName))).toBe(true);
});

test("Verify Add Sub Environment and Add Private Sub Environment create environments with the correct privacy", async ({
  user,
}) => {
  const { workspaceFlow, environmentFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const shared = await environmentFlow.createCollectionSubEnvironment(collection, {
    name: faker.string.alphanumeric(10),
  });
  const privateEnvironment = await environmentFlow.createCollectionSubEnvironment(collection, {
    name: faker.string.alphanumeric(10),
    isPrivate: true,
  });

  expect(shared.isPrivate).toBe(false);
  expect(privateEnvironment.isPrivate).toBe(true);
});
