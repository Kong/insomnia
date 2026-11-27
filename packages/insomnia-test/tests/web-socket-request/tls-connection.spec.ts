import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { DEFAULT_TIMEOUT, test, WS_SERVER_WSS } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify WebSocket Request Over a TLS Connection", async ({ user }) => {
  const { preferencesFlow, webSocketRequestFlow, workspaceFlow } =
    user.flowManager;

  await preferencesFlow.set({ validateSSL: false });

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const request = await webSocketRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: WS_SERVER_WSS,
  });
  await webSocketRequestFlow.send(request);
  const responseView = await webSocketRequestFlow.disconnect(request);

  await expect
    .poll(() => responseView.console(), { timeout: DEFAULT_TIMEOUT })
    .toContain("101 Switching Protocols");
  await expect
    .poll(
      async () =>
        (await responseView.events?.())?.some((event) =>
          event.data.includes("Request served by"),
        ),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeTruthy();
});
