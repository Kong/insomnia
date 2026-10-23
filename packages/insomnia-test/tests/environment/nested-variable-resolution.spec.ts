import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { EnvironmentKvPairDataType } from "../../models/environment";
import type { HttpRequest } from "../../models/http-request";
import { Project } from "../../models/project";

const leafVariable = "leaf";
const midVariable = "mid";
const topVariable = "top";

test("Verify Multi-Level Nested Variable Resolution", async ({ user }) => {
  const { environmentFlow, httpRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const finalValue = faker.string.alphanumeric(10);

  const environment = await environmentFlow.createBaseEnvironment(project, {
    name: faker.string.alphanumeric(10),
    kvPairData: [
      {
        id: "",
        name: leafVariable,
        value: finalValue,
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
      {
        id: "",
        name: midVariable,
        value: `{{${leafVariable}}}`,
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
      {
        id: "",
        name: topVariable,
        value: `{{${midVariable}}}`,
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
    ],
  });

  await environmentFlow.link(collection, environment);

  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post?value={{${topVariable}}}`,
  } satisfies HttpRequest);

  const responseView = await httpRequestFlow.send(request);
  expect(responseView.statusCode).toBe(200);
  expect(responseView.body).toMatchObject({ args: { value: finalValue } });
});
