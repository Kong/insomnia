import path from "node:path";

import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ProjectType } from "../../../enums/project-types";
import { test } from "../../../misc/fixtures";
import { Collection } from "../../../models/collection";
import { Project } from "../../../models/project";

const cascadeFixture = path.join(__dirname, "environment-cascade-collection.yaml");
const globalCollectionFixture = path.join(__dirname, "collection-for-global-environments.yaml");
const globalEnvironmentFixture = path.join(__dirname, "global-environment.yaml");
const projectEnvironmentSourceFixture = path.join(__dirname, "project-environment-source.yaml");

test("Verify the tooltip's Open inside the Manage Environments modal selects the source environment, and works again after selecting another", async ({
  user,
}) => {
  const { workspaceFlow, importFlow, environmentFlow, httpRequestFlow, variableSourceFlow } =
    user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  await importFlow.importFile(project, cascadeFixture);
  const collection = new Collection("Environment Cascade");
  await environmentFlow.activate(collection, "SubEnvA");

  await httpRequestFlow.get("cascade request no folder");
  await variableSourceFlow.openManageEnvironmentsModal();
  const hovered = await variableSourceFlow.hoverVariableInModal("baseOnlyVar");
  await variableSourceFlow.openSourceFromTooltip();
  const firstOpen = await variableSourceFlow.getNavigation("environments-modal", "Base Environment");
  await variableSourceFlow.selectModalEnvironment("SubEnvA");
  await variableSourceFlow.hoverVariableInModal("baseOnlyVar");
  await variableSourceFlow.openSourceFromTooltip();
  const secondOpen = await variableSourceFlow.getNavigation("environments-modal", "Base Environment");

  expect(hovered.tooltip).toContain("baseOnlyValue");
  expect(firstOpen.selectedEnvironmentRow).toBe(true);
  expect(firstOpen.manageEnvironmentsModalCount).toBe(1);
  expect(secondOpen.selectedEnvironmentRow).toBe(true);
  expect(secondOpen.manageEnvironmentsModalCount).toBe(1);
});

test("Verify the tooltip's Open closes the Manage Environments modal when it navigates to a folder environment", async ({
  user,
}) => {
  const { workspaceFlow, importFlow, environmentFlow, httpRequestFlow, variableSourceFlow } =
    user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  await importFlow.importFile(project, cascadeFixture);
  const collection = new Collection("Environment Cascade");
  await environmentFlow.activate(collection, "SubEnvA");

  await httpRequestFlow.get("cascade request");
  await variableSourceFlow.openManageEnvironmentsModal();
  const hovered = await variableSourceFlow.hoverVariableInModal("folderOverride");
  await variableSourceFlow.openSourceFromTooltip();
  await variableSourceFlow.waitForManageEnvironmentsModalClosed();
  const navigation = await variableSourceFlow.getNavigation("folder-pane");

  expect(hovered.tooltip).toContain("Folder Environment : cascadeFolder");
  expect(navigation.url).toMatch(/debug\/request-group\//);
  expect(navigation.environmentTabSelected).toBe(true);
  expect(navigation.manageEnvironmentsModalCount).toBe(0);
});

test("Verify the tooltip's Open navigates to a project environment source from the Manage Environments modal and from the request body", async ({
  user,
}) => {
  const { workspaceFlow, importFlow, httpRequestFlow, variableSourceFlow } =
    user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  await importFlow.importFile(project, globalCollectionFixture);
  await importFlow.importFile(project, globalEnvironmentFixture);
  const collection = new Collection("collection-for-global-environments");
  await variableSourceFlow.selectProjectEnvironment(collection, "global-environment");

  await httpRequestFlow.get("Global Var Request");
  await variableSourceFlow.openManageEnvironmentsModal();
  await variableSourceFlow.selectModalEnvironment("ExampleA");
  const hoveredInModal = await variableSourceFlow.hoverVariableInModal("global-base");
  await variableSourceFlow.openSourceFromTooltip();
  await variableSourceFlow.waitForManageEnvironmentsModalClosed();
  const fromModal = await variableSourceFlow.getNavigation("environment-page", "Base Environment");

  await httpRequestFlow.get("Global Var Request");
  const hoveredInBody = await variableSourceFlow.hoverVariable("global-base");
  await variableSourceFlow.openSourceFromTooltip();
  const fromBody = await variableSourceFlow.getNavigation("environment-page", "Base Environment");

  expect(hoveredInModal.tooltip).toContain("Project Environment : Base Environment");
  expect(fromModal.url).toMatch(/\/environment/);
  expect(fromModal.manageEnvironmentsModalCount).toBe(0);
  expect(fromModal.selectedEnvironmentRow).toBe(true);
  expect(hoveredInBody.tooltip).toContain("Project Environment : Base Environment");
  expect(fromBody.url).toMatch(/\/environment\/?$/);
  expect(fromBody.selectedEnvironmentRow).toBe(true);
});

test("Verify the tooltip's Open selects the source environment on the project environment page", async ({
  user,
}) => {
  const { workspaceFlow, importFlow, variableSourceFlow } =
    user.flowManager;
  const { workspacePage, environmentPage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  await importFlow.importFile(project, globalEnvironmentFixture);
  await workspacePage.clickNode(
    await workspacePage.resolveNode({ name: "global-environment" }),
  );
  await environmentPage.selectEnvironment("New Environment");

  const hovered = await variableSourceFlow.hoverEnvironmentPageVariable("global-base");
  await variableSourceFlow.openSourceFromTooltip();
  const navigation = await variableSourceFlow.getNavigation("environment-page", "Base Environment");

  expect(hovered.tooltip).toContain("Project Environment : Base Environment");
  expect(navigation.selectedEnvironmentRow).toBe(true);
});

test("Verify the project environment page attributes its own environments to the project", async ({
  user,
}) => {
  const { workspaceFlow, importFlow, variableSourceFlow } = user.flowManager;
  const { workspacePage, environmentPage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  await importFlow.importFile(project, projectEnvironmentSourceFixture);
  await workspacePage.clickNode(
    await workspacePage.resolveNode({ name: "project-environment-source" }),
  );
  await environmentPage.selectEnvironment("Source Sub Environment");

  const modal = await variableSourceFlow.inspectEnvironmentPageVariable(
    "text_base",
    "fromProjectBase",
  );

  expect(modal.source).toContain("Project Environment : Base Environment");
  expect(modal.preview).toBe("fromProjectBase");
});
