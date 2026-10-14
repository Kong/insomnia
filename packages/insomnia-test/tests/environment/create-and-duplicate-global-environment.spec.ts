import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { EnvironmentKvPairDataType } from "../../models/environment";
import type { HttpRequest } from "../../models/http-request";
import { Project } from "../../models/project";

test("Verify creating and duplicating a global environment", async ({
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

  const variableValue = faker.string.alphanumeric(10);
  const environment = await environmentFlow.createBaseEnvironment(project, {
    name: faker.string.alphanumeric(10),
    kvPairData: [
      {
        id: "",
        name: "globalVar",
        value: variableValue,
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
    ],
  });

  const duplicatedName = faker.string.alphanumeric(10);
  const duplicatedEnvironment = await workspaceFlow.duplicateEnvironment(
    environment,
    duplicatedName,
  );
  await environmentFlow.link(collection, {
    ...duplicatedEnvironment,
    name: "Base Environment",
  });

  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post?value={{ globalVar }}`,
  } satisfies HttpRequest);
  const responseView = await httpRequestFlow.send(request);

  expect(duplicatedEnvironment.id).not.toBe(environment.id);
  expect(duplicatedEnvironment.name).toBe(duplicatedName);
  expect(responseView.statusCode).toBe(200);
  expect(responseView.body).toMatchObject({ args: { value: variableValue } });
});
