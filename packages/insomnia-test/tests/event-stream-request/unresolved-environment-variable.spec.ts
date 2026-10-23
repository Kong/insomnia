import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { EVENT_STREAM_SERVER, expect, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { EnvironmentKvPairDataType } from "../../models/environment";
import { EventStreamMethod } from "../../models/event-stream-request";
import { Project } from "../../models/project";

const variableName = "unlinked";

test("Verify Unlinked Environment Variable Causes Error in Event Stream Request", async ({
  user,
}) => {
  const { environmentFlow, eventStreamRequestFlow, workspaceFlow } =
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

  const request = await eventStreamRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: EventStreamMethod.Get,
    url: `${EVENT_STREAM_SERVER}/{{${variableName}}}`,
  });

  await expect(eventStreamRequestFlow.send(request)).rejects.toThrow(
    /Failed to Render Request/,
  );
});
