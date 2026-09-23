import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { EnvironmentKvPairDataType } from "../../models/environment";
import type { HttpRequest } from "../../models/http-request";
import { Project } from "../../models/project";

const sharedVariable = "shared";

test("Verify Sub Environment Variable Overrides Base Environment", async ({
  user,
}) => {
  const { environmentFlow, httpRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const baseValue = faker.string.alphanumeric(10);
  const subValue = faker.string.alphanumeric(10);

  const baseEnvironment = await environmentFlow.create(project, {
    name: faker.string.alphanumeric(10),
    kvPairData: [
      {
        id: "",
        name: sharedVariable,
        value: baseValue,
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
    ],
  });
  const subEnvironment = await environmentFlow.create(baseEnvironment, {
    name: faker.string.alphanumeric(10),
    kvPairData: [
      {
        id: "",
        name: sharedVariable,
        value: subValue,
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
    ],
  });
  await environmentFlow.link(collection, subEnvironment);

  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post?value={{${sharedVariable}}}`,
  } satisfies HttpRequest);
  const response = await httpRequestFlow.send(request);
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({ args: { value: subValue } });
});
