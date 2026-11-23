import { readFileSync } from "node:fs";
import path from "node:path";

import { faker } from "@faker-js/faker";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { TreeNodeType } from "@package/enums/tree-node-types";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify OpenAPI 3.2 Import Creates A Request Per Operation Including QUERY And Custom Methods", async ({
  user,
}) => {
  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "operations.yaml"),
  );

  const requestNames = (await workspacePage.getNodes())
    .filter((node) => node.type === TreeNodeType.Request)
    .map((node) => node.name);
  const list = await httpRequestFlow.get("List pets");
  const create = await httpRequestFlow.get("Create a pet");
  const search = await httpRequestFlow.get("Search pets");
  const purge = await httpRequestFlow.get("Purge pet cache");
  const get = await httpRequestFlow.get("Get a pet");

  expect([...requestNames].sort()).toEqual(
    [
      "Create a pet",
      "Get a pet",
      "List pets",
      "Purge pet cache",
      "Search pets",
    ].sort(),
  );
  expect(list).toMatchObject({
    method: HttpMethod.Get,
    url: "{{ _.base_url }}/pets",
  });
  expect(create).toMatchObject({
    method: HttpMethod.Post,
    url: "{{ _.base_url }}/pets",
  });
  expect(JSON.parse(create!.body!.text!)).toEqual({
    name: "string",
    status: "available",
  });
  expect(search).toMatchObject({
    method: HttpMethod.Query,
    url: "{{ _.base_url }}/pets",
  });
  expect(JSON.parse(search!.body!.text!)).toEqual({ name: "string" });
  expect(purge).toMatchObject({
    method: "PURGE",
    url: "{{ _.base_url }}/pets",
  });
  expect(get).toMatchObject({
    method: HttpMethod.Get,
    url: "{{ _.base_url }}/pets/:id",
  });
});

test("Verify A Duplicate POST In additionalOperations Imports Two POST Requests While The Design Spec Reports Lint Errors", async ({
  user,
}) => {
  const { httpRequestFlow, importFlow, specFlow, workspaceFlow } =
    user.flowManager;
  const { specPage, workspacePage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "duplicate-post.yaml"),
  );
  const requestNames = (await workspacePage.getNodes())
    .filter((node) => node.type === TreeNodeType.Request)
    .map((node) => node.name);
  const create = await httpRequestFlow.get("Create a pet");
  const createAgain = await httpRequestFlow.get("Create a pet again");
  const purge = await httpRequestFlow.get("Purge pet cache");

  await workspaceFlow.createCollection(
    project,
    new Collection(
      faker.string.alphanumeric(10),
      readFileSync(path.join(import.meta.dirname, "duplicate-post.yaml"), "utf8"),
    ),
  );
  await expect
    .poll(() => specPage.getLintSummary(), { timeout: DEFAULT_TIMEOUT })
    .not.toBe("none");
  await specPage.expandLintPanel();
  await expect
    .poll(() => specPage.getLintEntryCodes(), { timeout: DEFAULT_TIMEOUT })
    .toContain("oas3-schema");
  const lintSummary = await specPage.getLintSummary();
  const generateEnabled = await specFlow.isGenerateRequestsEnabled();

  expect([...requestNames].sort()).toEqual(
    ["Create a pet", "Create a pet again", "Purge pet cache"].sort(),
  );
  expect(create).toMatchObject({ method: HttpMethod.Post });
  expect(createAgain).toMatchObject({ method: HttpMethod.Post });
  expect(purge).toMatchObject({ method: "PURGE" });
  expect(lintSummary === "none" ? 0 : lintSummary.errors).toBeGreaterThan(0);
  expect(generateEnabled).toBe(false);
});
