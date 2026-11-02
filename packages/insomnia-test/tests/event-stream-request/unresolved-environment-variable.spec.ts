import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ProjectType } from "@package/enums/project-types";
import { EVENT_STREAM_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { EnvironmentKvPairDataType } from "@package/models/environment";
import { EventStreamMethod } from "@package/models/event-stream-request";
import { Project } from "@package/models/project";

const variableName = "unlinked";

test("Verify Unlinked Environment Variable Causes Error in Event Stream Request", async ({
  user,
}) => {
  const { environmentFlow, eventStreamRequestFlow, workspaceFlow } =
    user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  await environmentFlow.createBaseEnvironment(project, {
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

  const request = await eventStreamRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: EventStreamMethod.Get,
    url: `${EVENT_STREAM_SERVER}/{{${variableName}}}`,
  });

  await expect(eventStreamRequestFlow.send(request)).rejects.toThrow(
    /Failed to Render Request/,
  );
});
