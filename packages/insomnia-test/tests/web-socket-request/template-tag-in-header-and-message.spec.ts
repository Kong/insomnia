import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ContentType } from "@package/enums/content-type";
import { ProjectType } from "@package/enums/project-types";
import { DEFAULT_TIMEOUT, test, WS_SERVER } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";

const tag = "{% base64 'encode', 'normal', 'abc' %}";

test("Verify Template Tags in WebSocket Header and Message Are Resolved", async ({
  user,
}) => {
  const { webSocketRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const request = await webSocketRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: WS_SERVER,
    headers: [{ name: "X-Tag", value: tag }],
  });
  await webSocketRequestFlow.send(request);
  await webSocketRequestFlow.sendMessage(request, {
    contentType: ContentType.Plain,
    content: tag,
  });
  const responseView = await webSocketRequestFlow.disconnect(request);

  await expect
    .poll(() => responseView.console(), { timeout: DEFAULT_TIMEOUT })
    .toContain("x-tag: YWJj");
  await expect
    .poll(
      async () =>
        (await responseView.events?.())?.some((event) => event.data === "YWJj"),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeTruthy();
});
