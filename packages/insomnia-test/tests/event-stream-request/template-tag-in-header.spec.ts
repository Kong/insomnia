import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { DEFAULT_TIMEOUT, EVENT_STREAM_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { EventStreamMethod } from "@package/models/event-stream-request";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify Template Tag in Event Stream Request Header Is Resolved", async ({
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

  const request = await eventStreamRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: EventStreamMethod.Get,
    url: `${EVENT_STREAM_SERVER}/sse-events/1`,
    headers: [
      {
        name: "X-Tag",
        value: "{% base64 'encode', 'normal', 'abc' %}",
      },
    ],
  });
  const responseView = await eventStreamRequestFlow.send(request);

  await expect
    .poll(() => responseView.console(), { timeout: DEFAULT_TIMEOUT })
    .toContain("X-Tag: YWJj");
});
