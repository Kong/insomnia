import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { expect, test, WS_SERVER } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { EnvironmentKvPairDataType } from "../../models/environment";
import { Project } from "../../models/project";

const variableName = "unlinked";

test("Verify Unlinked Environment Variable Causes Error in WebSocket Request", async ({
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

  await environmentFlow.create(project, {
    name: faker.string.alphanumeric(10),
    kvPairData: [
      {
        id: "",
        name: variableName,
        value: "variable",
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
    ],
  });

  const request = await webSocketRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: `${WS_SERVER}/{{${variableName}}}`,
  });

  await expect(webSocketRequestFlow.send(request)).rejects.toThrow(
    /Failed to Render Request/,
  );
});
