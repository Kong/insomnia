import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { RequestState } from "../../enums/request-state";
import {
  DEFAULT_TIMEOUT,
  EVENT_STREAM_SERVER,
  expect,
  test,
} from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { EventStreamMethod } from "../../models/event-stream-request";
import { Project } from "../../models/project";

const eventCount = 20;

test("Verify Disconnecting an Open Event Stream Stops It Early", async ({
  user,
}) => {
  const { eventStreamRequestFlow, workspaceFlow } = user.flowManager;
  const { eventStreamRequestPage, responsePage } = user.pageManager;

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
    url: `${EVENT_STREAM_SERVER}/sse-events/${eventCount}`,
  });
  await eventStreamRequestFlow.send(request);
  await eventStreamRequestPage.disconnect(async () => {
    const events = await responsePage.getEvents();
    expect(
      events?.some((event) => event.data.includes("Starting Events")),
    ).toBeTruthy();
  });

  await expect
    .poll(() => responsePage.getRequestState(), { timeout: DEFAULT_TIMEOUT })
    .toEqual(RequestState.Idle);
  const events = await responsePage.getEvents();
  expect(
    events?.filter((event) => event.data.includes("Hello from the server!"))
      .length,
  ).toBeLessThan(eventCount);
});
