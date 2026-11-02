import { faker } from "@faker-js/faker";
import { ContentType } from "@package/enums/content-type";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { DEFAULT_TIMEOUT, HTTP_SERVER } from "@package/misc/constants";
import { test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { EnvironmentKvPairDataType } from "@package/models/environment";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

const url = `${HTTP_SERVER}/post`;
const preRequestScript = "console.log('pre-request script');";
const afterResponseScript = "console.log('after-response script');";

test("Verify Create HTTP Request", async ({ user }) => {
  const { environmentFlow, httpRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const headerNameVariable = faker.string.alpha(8);
  const templatedHeaderName = faker.string.alphanumeric(8);
  const templatedHeaderValue = faker.string.alphanumeric(10);
  const environment = await environmentFlow.createBaseEnvironment(project, {
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
  const responseView = await httpRequestFlow.send(request!);
  expect(responseView.statusBar.text).toBe("200 OK");
  await expect
    .poll(() => responseView.console(), { timeout: DEFAULT_TIMEOUT })
    .toContain("log: pre-request script");
  await expect
    .poll(() => responseView.console(), { timeout: DEFAULT_TIMEOUT })
    .toContain("log: after-response script");
  expect(responseView.preview).toMatchObject({
    data: "Test",
    args: { [paramName]: paramValue },
    headers: expect.objectContaining({
      [headerName.toLowerCase()]: headerValue,
      [templatedHeaderName.toLowerCase()]: templatedHeaderValue,
    }),
  });

  const duplicatedName = `${request!.name} (Copy)`;
  await workspaceFlow.duplicateRequest(request!, duplicatedName);

  const duplicated = await httpRequestFlow.get(duplicatedName);
  expect(duplicated).toBeTruthy();
  expect(duplicated!.url).toBe(request!.url);
  expect(duplicated!.method).toBe(request!.method);

  const duplicatedResponse = await httpRequestFlow.send(duplicated!);
  expect(duplicatedResponse.statusBar.code).toBe(200);
  expect(duplicatedResponse.preview).toMatchObject({ data: "Test" });
});
