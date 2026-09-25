import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, MOCK_API_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { EnvironmentKvPairDataType } from "../../models/environment";
import { Project } from "../../models/project";

const variableName = "unlinked";

test("Verify Linked Environment Variable Causes Error", async ({ user }) => {
  const { environmentFlow, httpRequestFlow, workspaceFlow } = user.flowManager;

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

  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${MOCK_API_SERVER}/{{${variableName}}}`,
  });
  await expect(httpRequestFlow.send(request)).rejects.toThrow(
    /environment variable is missing.*have not been assigned.*unlinked/s,
  );
});
