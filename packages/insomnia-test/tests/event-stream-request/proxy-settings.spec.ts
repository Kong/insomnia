import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { DEFAULT_TIMEOUT, EVENT_STREAM_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { EventStreamMethod } from "@package/models/event-stream-request";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify Enabling a Proxy Routes Event Stream Requests Through It", async ({
  user,
}) => {
  const { eventStreamRequestFlow, preferencesFlow, workspaceFlow } =
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

  await preferencesFlow.set({
    proxyEnabled: true,
    httpProxy: "127.0.0.1:1111",
    httpsProxy: "127.0.0.1:2222",
    noProxy: "",
  });

  const responseView = await eventStreamRequestFlow.send(request, {
    expectConnected: false,
  });

  await expect
    .poll(() => responseView.console(), { timeout: DEFAULT_TIMEOUT })
    .toContain("Using proxy: http://127.0.0.1:1111");
});
