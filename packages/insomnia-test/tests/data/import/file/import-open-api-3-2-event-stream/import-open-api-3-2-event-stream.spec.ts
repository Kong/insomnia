import path from "node:path";

import { faker } from "@faker-js/faker";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify A text/event-stream Response Imports As An Event Stream Request With The Accept Header", async ({
  user,
}) => {
  const { eventStreamRequestFlow, httpRequestFlow, importFlow, workspaceFlow } =
    user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "event-stream.yaml"),
  );
  const stream = await eventStreamRequestFlow.get("Stream events");
  const list = await httpRequestFlow.get("List pets");

  expect(stream).toMatchObject({
    method: HttpMethod.Get,
    url: "{{ _.base_url }}/events",
  });
  expect(stream!.headers).toContainEqual(
    expect.objectContaining({ name: "Accept", value: "text/event-stream" }),
  );
  expect(list).toMatchObject({
    method: HttpMethod.Get,
    url: "{{ _.base_url }}/pets",
  });
});
