import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import {
  DEFAULT_TIMEOUT,
  expect,
  HTTP_SERVER,
  test,
} from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/post`;

test("Verify insomnia.environment.replaceIn resolves and returns a string synchronously", async ({
  user,
}) => {
  const { httpRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const variableName = faker.string.alpha(8);
  const variableValue = faker.string.alphanumeric(10);
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    preRequestScript: `
      insomnia.environment.set('${variableName}', '${variableValue}');
      const v = insomnia.environment.replaceIn('{{ ${variableName} }}');
      console.log(typeof v, v);
    `,
  });
  const response = await httpRequestFlow.send(request);

  await expect
    .poll(() => response.console?.(), { timeout: DEFAULT_TIMEOUT })
    .toContain(`log: string ${variableValue}`);
  const consoleText = await response.console?.();
  expect(consoleText).not.toContain("Promise");
});

test("Verify a script that awaits insomnia.environment.replaceIn as a workaround still resolves correctly", async ({
  user,
}) => {
  const { httpRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const variableName = faker.string.alpha(8);
  const variableValue = faker.string.alphanumeric(10);
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    preRequestScript: `
      insomnia.environment.set('${variableName}', '${variableValue}');
      const v = await insomnia.environment.replaceIn('{{ ${variableName} }}');
      console.log(typeof v, v);
    `,
  });
  const response = await httpRequestFlow.send(request);

  await expect
    .poll(() => response.console?.(), { timeout: DEFAULT_TIMEOUT })
    .toContain(`log: string ${variableValue}`);
});
