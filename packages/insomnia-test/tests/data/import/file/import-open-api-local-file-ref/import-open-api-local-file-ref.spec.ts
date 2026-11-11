import path from "node:path";

import { faker } from "@faker-js/faker";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify An OpenAPI Document With A Local File $ref Imports Without Reading The File While Document Refs Still Resolve", async ({
  user,
}) => {
  test.fail(true, "INS-4293");

  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "local-file-ref.yaml"),
  );

  const list = await httpRequestFlow.get("List pets");
  const createPet = await httpRequestFlow.get("Create a pet");
  const createOwner = await httpRequestFlow.get("Create an owner");

  expect(list?.method).toBe(HttpMethod.Get);
  expect(createPet?.method).toBe(HttpMethod.Post);
  expect(createOwner?.method).toBe(HttpMethod.Post);
  expect(JSON.parse(createPet!.body!.text!)).toEqual({ name: "string" });
  expect(createOwner!.body!.text ?? "").toBe("");
});
