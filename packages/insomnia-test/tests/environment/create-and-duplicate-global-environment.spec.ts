import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { EnvironmentKvPairDataType } from "../../models/environment";
import type { HttpRequest } from "../../models/http-request";
import { Project } from "../../models/project";

test("Verify creating and duplicating a private global environment", async ({
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

  const variableValue = faker.string.alphanumeric(10);
  const environment = await environmentFlow.create(project, {
    name: faker.string.alphanumeric(10),
    isPrivate: true,
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
  const duplicatedEnvironment = await workspaceFlow.duplicate(
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
  const response = await httpRequestFlow.send(request);

  expect(duplicatedEnvironment.id).not.toBe(environment.id);
  expect(duplicatedEnvironment.name).toBe(duplicatedName);
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({ args: { value: variableValue } });
});
