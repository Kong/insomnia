import path from "node:path";

import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ProjectType } from "../../../enums/project-types";
import { test } from "../../../misc/fixtures";
import { Collection } from "../../../models/collection";
import { Project } from "../../../models/project";

test("Verify hovering an undefined variable swaps the tooltip to the render error instead of vanishing", async ({
  user,
}) => {
  const { workspaceFlow, importFlow, environmentFlow, httpRequestFlow, variableSourceFlow } =
    user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  await importFlow.importFile(
    project,
    path.join(__dirname, "collection-for-global-environments.yaml"),
  );
  const collection = new Collection("collection-for-global-environments");
  await environmentFlow.activate(collection, "ExampleA");

  await httpRequestFlow.get("New Request");
  const tooltips = await variableSourceFlow.hoverBetweenVariables(
    "exampleString",
    "subenvA0",
    "global-base",
    "Failed to render environment variables",
  );

  expect(tooltips.first).toContain("subenvA0");
  expect(tooltips.second).toContain("Failed to render environment variables");
});

test("Verify hovering the tooltip's own content keeps it visible", async ({ user }) => {
  const { workspaceFlow, importFlow, environmentFlow, httpRequestFlow, variableSourceFlow } =
    user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  await importFlow.importFile(
    project,
    path.join(__dirname, "environment-cascade-collection.yaml"),
  );
  const collection = new Collection("Environment Cascade");
  await environmentFlow.activate(collection, "Base Environment");

  await httpRequestFlow.get("cascade request no folder");
  const stillVisible = await variableSourceFlow.hoverTooltipContent("cascadeVar");

  expect(stillVisible).toBe(true);
});
