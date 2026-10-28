import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ProjectType } from "../../enums/project-types";
import { DEFAULT_TIMEOUT, EVENT_STREAM_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { EventStreamMethod } from "../../models/event-stream-request";
import { Project } from "../../models/project";

test("Verify Duplicated Event Stream Request Keeps Url, Method and Headers", async ({
  user,
}) => {
  const { eventStreamRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const headerValue = faker.string.alphanumeric(10);
  const request = await eventStreamRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: EventStreamMethod.Get,
    url: `${EVENT_STREAM_SERVER}/sse-events/1`,
    headers: [{ name: "X-Custom", value: headerValue }],
  });
  const duplicatedName = `${request.name} (Copy)`;
  await workspaceFlow.duplicateRequest(request, duplicatedName);

  const duplicated = await eventStreamRequestFlow.get(duplicatedName);
  const responseView = await eventStreamRequestFlow.send(duplicated!);

  expect(duplicated).toBeTruthy();
  expect(duplicated!.url).toBe(request.url);
  expect(duplicated!.method).toBe(request.method);
  await expect
    .poll(() => responseView.console?.(), { timeout: DEFAULT_TIMEOUT })
    .toContain(`X-Custom: ${headerValue}`);
});
