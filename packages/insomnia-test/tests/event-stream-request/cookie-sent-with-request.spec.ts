import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import {
  DEFAULT_TIMEOUT,
  EVENT_STREAM_SERVER,
  expect,
  test,
} from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { EventStreamMethod } from "../../models/event-stream-request";
import { Project } from "../../models/project";

test("Verify Linked Cookie Is Sent With Event Stream Request", async ({
  user,
}) => {
  const { cookieFlow, eventStreamRequestFlow, workspaceFlow } =
    user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
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

  const response = await eventStreamRequestFlow.send(request);

  await expect
    .poll(() => response.console?.(), { timeout: DEFAULT_TIMEOUT })
    .toContain("Enable cookie sending with jar of 1 cookie");
});
