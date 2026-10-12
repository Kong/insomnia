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

test("Verify Template Tag in Event Stream Request Header Is Resolved", async ({
  user,
}) => {
  const { eventStreamRequestFlow, workspaceFlow } = user.flowManager;

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
    headers: [
      {
        name: "X-Tag",
        value: "{% base64 'encode', 'normal', 'abc' %}",
      },
    ],
  });
  const response = await eventStreamRequestFlow.send(request);

  await expect
    .poll(() => response.console?.(), { timeout: DEFAULT_TIMEOUT })
    .toContain("X-Tag: YWJj");
});
