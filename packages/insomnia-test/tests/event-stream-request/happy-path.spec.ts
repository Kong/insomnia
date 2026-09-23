import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { SendButtonState } from "../../enums/send-button-state";
import { EVENT_STREAM_SERVER,expect, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { EnvironmentKvPairDataType } from "../../models/environment";
import { EventStreamMethod } from "../../models/event-stream-request";
import { Project } from "../../models/project";

const eventStreamUrl = "http://{{url}}/sse-events/5";

test("Verify Create Event Stream Request", async ({ user }) => {
  const { environmentFlow, eventStreamRequestFlow, workspaceFlow } =
    user.flowManager;
  const { responsePage, workspacePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const environment = await environmentFlow.create(project, {
    name: faker.string.alphanumeric(10),
    kvPairData: [
      {
        id: "",
        name: "url",
        value: EVENT_STREAM_SERVER.replace("http://", ""),
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
    ],
  });

  const request = await eventStreamRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: EventStreamMethod.Get,
    url: eventStreamUrl,
  });

  await environmentFlow.link(request, environment);

  await eventStreamRequestFlow.send(request);
  await expect
    .poll(
      async () => {
        const events = await responsePage.getEvents();
        return events!.some((event) => event.data.includes("Disconnected"));
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();
  expect(await responsePage.getSendButtonState()).toEqual(SendButtonState.Idle);

  await workspaceFlow.delete(collection);
  const deletedNames = [collection.name, request.name];
  await expect
    .poll(
      async () => {
        const names = (await workspacePage.getNodes()).map((node) => node.name);
        return deletedNames.filter((name) => names.includes(name));
      },
      { timeout: 10_000 },
    )
    .toEqual([]);
});
