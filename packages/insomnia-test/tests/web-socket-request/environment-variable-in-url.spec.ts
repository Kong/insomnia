import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import {
  DEFAULT_TIMEOUT,
  expect,
  test,
  WS_SERVER,
} from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { EnvironmentKvPairDataType } from "../../models/environment";
import { Project } from "../../models/project";

test("Verify Environment Variable in WebSocket Request URL Is Resolved", async ({
  user,
}) => {
  const { environmentFlow, webSocketRequestFlow, workspaceFlow } =
    user.flowManager;

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
        value: WS_SERVER.replace("ws://", ""),
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
    ],
  });

  const request = await webSocketRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: "ws://{{url}}",
  });
  await environmentFlow.link(request, environment);

  await webSocketRequestFlow.send(request);
  const response = await webSocketRequestFlow.disconnect(request);

  await expect
    .poll(() => response.console?.(), { timeout: DEFAULT_TIMEOUT })
    .toContain(`Preparing request to ${WS_SERVER}`);
  await expect
    .poll(
      async () =>
        (await response.events?.())?.some((event) =>
          event.data.includes("Connected successfully"),
        ),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeTruthy();
});
