import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { DEFAULT_TIMEOUT, EVENT_STREAM_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { EventStreamMethod } from "@package/models/event-stream-request";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify Linked Cookie Is Sent With Event Stream Request", async ({
  user,
}) => {
  const { cookieFlow, eventStreamRequestFlow, workspaceFlow } =
    user.flowManager;

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
  });
  await cookieFlow.link(request, [
    {
      key: faker.string.alphanumeric(8),
      value: faker.string.alphanumeric(8),
      domain: "localhost",
      path: "/",
    },
  ]);

  const responseView = await eventStreamRequestFlow.send(request);

  await expect
    .poll(() => responseView.console(), { timeout: DEFAULT_TIMEOUT })
    .toContain("Enable cookie sending with jar of 1 cookie");
});
