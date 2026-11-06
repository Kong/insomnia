import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { DEFAULT_TIMEOUT, EVENT_STREAM_SERVER_HTTPS, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { EventStreamMethod } from "@package/models/event-stream-request";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify Event Stream Request Over a TLS Connection", async ({ user }) => {
  const { eventStreamRequestFlow, preferencesFlow, workspaceFlow } =
    user.flowManager;

  await preferencesFlow.set({ validateSSL: false });

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
    url: `${EVENT_STREAM_SERVER_HTTPS}/sse-events/1`,
  });
  const responseView = await eventStreamRequestFlow.send(request);

  await expect
    .poll(() => responseView.console(), { timeout: DEFAULT_TIMEOUT })
    .toContain("TLSv1.3");
  await expect
    .poll(
      async () =>
        (await responseView.events?.())?.some((event) =>
          event.data.includes("Starting Events"),
        ),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeTruthy();
});
