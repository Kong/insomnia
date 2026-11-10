import path from "node:path";

import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify OpenAPI 3.2 querystring Parameter With A Form-Urlencoded Schema Expands Into Query Parameters", async ({
  user,
}) => {
  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "querystring.yaml"),
  );

  const form = await httpRequestFlow.get("Form-urlencoded querystring");
  const json = await httpRequestFlow.get("JSON querystring");

  expect(form?.params).toEqual([
    { name: "q", value: "string", disabled: false },
    { name: "limit", value: "0", disabled: true },
  ]);
  expect(json?.params).toEqual([]);
});

test("Verify Path Item Parameters Merge Into Every Operation And Are Overridden By Operation Parameters", async ({
  user,
}) => {
  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "path-level-parameters.yaml"),
  );

  const get = await httpRequestFlow.get("Get a pet");
  const purge = await httpRequestFlow.get("Purge a pet");

  const toValues = (params: { name: string; value: string }[] = []) =>
    Object.fromEntries(params.map((param) => [param.name, param.value]));
  expect(get?.params).toHaveLength(2);
  expect(toValues(get?.params)).toEqual({
    verbose: "true",
    shared: "inherited",
  });
  expect(purge?.params).toHaveLength(2);
  expect(toValues(purge?.params)).toEqual({
    verbose: "false",
    shared: "inherited",
  });
});

test("Verify OpenAPI Example Selection Prefers dataValue Skips serializedValue And Keeps Falsy Values", async ({
  user,
}) => {
  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "examples.yaml"),
  );

  const create = await httpRequestFlow.get("Create with examples");
  const flags = await httpRequestFlow.get("Falsy and enum values");

  expect(JSON.parse(create!.body!.text!)).toEqual({
    name: "Rex",
    status: "available",
  });
  expect(flags?.params?.map(({ name, value }) => [name, value])).toEqual([
    ["active", "false"],
    ["offset", "0"],
    ["nick", ""],
    ["kind", "fixed"],
    ["state", "open"],
    ["tag", "red"],
  ]);
});
