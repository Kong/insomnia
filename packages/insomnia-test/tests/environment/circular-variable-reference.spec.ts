import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { EnvironmentKvPairDataType } from "../../models/environment";
import type { HttpRequest } from "../../models/http-request";
import { Project } from "../../models/project";

const variableA = "a";
const variableB = "b";

test("Verify Circular Variable Reference Resolves To Literal Unresolved Text", async ({
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

  const environment = await environmentFlow.create(project, {
    name: faker.string.alphanumeric(10),
    kvPairData: [
      {
        id: "",
        name: variableA,
        value: `{{${variableB}}}`,
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
      {
        id: "",
        name: variableB,
        value: `{{${variableA}}}`,
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
    ],
  });
  await environmentFlow.link(collection, environment);

  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post?value={{${variableA}}}`,
  } satisfies HttpRequest);

  const response = await httpRequestFlow.send(request);
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({ args: { value: `{{${variableA}}}` } });
});
