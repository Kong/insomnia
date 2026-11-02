import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { MOCK_API_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { EnvironmentKvPairDataType } from "@package/models/environment";
import { Project } from "@package/models/project";

const variableName = "unlinked";

test("Verify Unlinked Environment Variable Causes Error", async ({ user }) => {
  const { environmentFlow, httpRequestFlow, workspaceFlow } = user.flowManager;

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

  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${MOCK_API_SERVER}/{{${variableName}}}`,
  });
  await expect(httpRequestFlow.send(request)).rejects.toThrow(
    /environment variable is missing.*have not been assigned.*unlinked/s,
  );
});
