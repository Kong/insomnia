import { faker } from "@faker-js/faker";

import { ContentType } from "../../enums/content-type";
import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import {
  DEFAULT_TIMEOUT,
  expect,
  HTTP_SERVER,
  test,
} from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { EnvironmentKvPairDataType } from "../../models/environment";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/post`;
const preRequestScript = "console.log('pre-request script');";
const afterResponseScript = "console.log('after-response script');";

test("Verify Create HTTP Request", async ({ user }) => {
  const { environmentFlow, httpRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const headerNameVariable = faker.string.alpha(8);
  const templatedHeaderName = faker.string.alphanumeric(8);
  const templatedHeaderValue = faker.string.alphanumeric(10);
  const environment = await environmentFlow.create(project, {
    name: faker.string.alphanumeric(10),
    kvPairData: [
      {
        id: "",
        name: headerNameVariable,
        value: templatedHeaderName,
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
    ],
  });
  await environmentFlow.link(collection, environment);

  const paramName = "greeting";
  const paramValue = "hello";
  const headerName = "X-Custom-Header";
  const headerValue = faker.string.alphanumeric(10);

  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: url,
    params: [{ name: paramName, value: paramValue }],
    headers: [
      { name: headerName, value: headerValue },
      { name: `{{${headerNameVariable}}}`, value: templatedHeaderValue },
    ],
    body: { mimeType: ContentType.Plain, text: "Test" },
    preRequestScript,
    afterResponseScript,
  });
  const response = await httpRequestFlow.send(request!);
  expect(response.statusCode).toBe(200);
  expect(response.statusMessage).toBe("OK");
  await expect
    .poll(() => response.console?.(), { timeout: DEFAULT_TIMEOUT })
    .toContain("log: pre-request script");
  expect(response.body).toMatchObject({
    data: "Test",
    args: { [paramName]: paramValue },
    headers: expect.objectContaining({
      [headerName.toLowerCase()]: headerValue,
      [templatedHeaderName.toLowerCase()]: templatedHeaderValue,
    }),
  });

  const duplicatedName = `${request!.name} (Copy)`;
  await workspaceFlow.duplicate(request!, duplicatedName);

  const duplicated = await httpRequestFlow.get(duplicatedName);
  expect(duplicated).toBeTruthy();
  expect(duplicated!.url).toBe(request!.url);
  expect(duplicated!.method).toBe(request!.method);

  const duplicatedResponse = await httpRequestFlow.send(duplicated!);
  expect(duplicatedResponse.statusCode).toBe(200);
  expect(duplicatedResponse.body).toMatchObject({ data: "Test" });
});
