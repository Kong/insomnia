import path from "node:path";

import { faker } from "@faker-js/faker";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify OpenAPI 3.0 And 3.1 Documents Still Import With Enum Fields Taking The First Enum Value", async ({
  user,
}) => {
  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "petstore-3.0.yaml"),
  );
  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "petstore-3.1.yaml"),
  );

  const threeZero = await httpRequestFlow.get("Add a pet");
  const threeOne = await httpRequestFlow.get("Add a three one pet");

  for (const request of [threeZero, threeOne]) {
    expect(request).toMatchObject({
      method: HttpMethod.Post,
      url: "{{ _.base_url }}/pets",
    });
    expect(JSON.parse(request!.body!.text!)).toEqual({
      name: "string",
      status: "available",
    });
  }
});

test("Verify A Swagger 2.0 Document Still Imports With Its Self-Referencing Definition Resolved", async ({
  user,
}) => {
  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "petstore-swagger-2.0.yaml"),
  );

  const create = await httpRequestFlow.get("Add a swagger pet");

  expect(create).toMatchObject({
    method: HttpMethod.Post,
    url: "{{ _.base_url }}/pets",
  });
  expect(JSON.parse(create!.body!.text!)).toEqual({
    name: "string",
    parent: { name: "string", parent: {} },
  });
});
