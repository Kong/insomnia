import path from "node:path";

import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify A querystring Parameter Is Expanded When Its Form-Urlencoded Media Type Has Parameters Or Different Casing", async ({
  user,
}) => {
  test.fail(true, 'INS-4294');

  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "querystring-media-types.yaml"),
  );
  const charset = await httpRequestFlow.get("Querystring with charset");
  const uppercase = await httpRequestFlow.get(
    "Querystring with mixed case media type",
  );
  const json = await httpRequestFlow.get("Querystring with JSON content");

  expect(charset!.params).toEqual([
    expect.objectContaining({ name: "name", value: "string", disabled: false }),
    expect.objectContaining({ name: "limit", value: "10", disabled: true }),
  ]);
  expect(uppercase!.params).toEqual([
    expect.objectContaining({ name: "name", value: "string", disabled: false }),
  ]);
  expect(json!.params ?? []).toHaveLength(0);
});
