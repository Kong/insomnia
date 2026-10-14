import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { EnvironmentKvPairDataType } from "../../models/environment";
import type { HttpRequest } from "../../models/http-request";
import { Project } from "../../models/project";

const lowerCaseVariable = "caseVar";
const upperCaseVariable = "CaseVar";

test("Verify Variable Names Are Case Sensitive Across Environment Levels", async ({
  user,
}) => {
  const { environmentFlow, httpRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const baseValue = faker.string.alphanumeric(10);
  const subValue = faker.string.alphanumeric(10);

  const baseEnvironment = await environmentFlow.createBaseEnvironment(project, {
    name: faker.string.alphanumeric(10),
    kvPairData: [
      {
        id: "",
        name: lowerCaseVariable,
        value: baseValue,
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
    ],
  });
  const subEnvironment = await environmentFlow.createSubEnvironment(baseEnvironment, {
    name: faker.string.alphanumeric(10),
    kvPairData: [
      {
        id: "",
        name: upperCaseVariable,
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
    url: `${HTTP_SERVER}/post?lower={{${lowerCaseVariable}}}&upper={{${upperCaseVariable}}}`,
  } satisfies HttpRequest);

  const responseView = await httpRequestFlow.send(request);
  expect(responseView.statusCode).toBe(200);
  expect(responseView.body).toMatchObject({
    args: { lower: baseValue, upper: subValue },
  });
});
