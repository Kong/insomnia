import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../../../enums/http-method";
import { ProjectType } from "../../../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../../../misc/fixtures";
import { Collection } from "../../../../models/collection";
import type { CurlCommand } from "../../../../models/curl-command";
import type { HttpRequest } from "../../../../models/http-request";
import { Project } from "../../../../models/project";

const url = `${HTTP_SERVER}/post`;
const paramName = faker.string.alpha(6);
const paramValue = `${faker.string.alphanumeric(4)} ${faker.string.alphanumeric(4)}`;
const command = `curl -G "${url}" --data-urlencode "${paramName}=${paramValue}"`;

test("Import HTTP Request by Curl Command With -G and --data-urlencode Converts Data To Query Params", async ({
  user,
}) => {
  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const curl: CurlCommand = { command };
  await importFlow.importCurl(project, collection, curl);

  const request = {
    name: url,
    method: HttpMethod.Get,
    url,
    params: [{ name: paramName, value: encodeURIComponent(paramValue) }],
  } satisfies HttpRequest;
  const responseView = await httpRequestFlow.send(request);

  expect(await httpRequestFlow.get(url)).toMatchObject(request);
  expect(responseView.statusCode).toBe(200);
});
