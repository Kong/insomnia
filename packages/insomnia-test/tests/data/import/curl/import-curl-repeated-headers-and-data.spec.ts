import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../../../enums/http-method";
import { ProjectType } from "../../../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../../../misc/fixtures";
import { Collection } from "../../../../models/collection";
import type { CurlCommand } from "../../../../models/curl-command";
import type { HttpRequest } from "../../../../models/http-request";
import { Project } from "../../../../models/project";

const url = `${HTTP_SERVER}/post`;
const headerName = "X-Custom";
const firstHeaderValue = faker.string.alphanumeric(6);
const secondHeaderValue = faker.string.alphanumeric(6);
const firstDataKey = faker.string.alpha(4);
const secondDataKey = faker.string.alpha(4);
const firstDataValue = faker.string.alphanumeric(4);
const secondDataValue = faker.string.alphanumeric(4);
const command = `curl -X POST "${url}" -H "${headerName}: ${firstHeaderValue}" -H "${headerName}: ${secondHeaderValue}" -d "${firstDataKey}=${firstDataValue}" -d "${secondDataKey}=${secondDataValue}"`;

test("Import HTTP Request by Curl Command With Repeated -H and -d Flags Merges Headers and Concatenates Data", async ({
  user,
}) => {
  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const curl: CurlCommand = { command };
  await importFlow.importCurl(project, collection, curl);

  const request = {
    name: url,
    method: HttpMethod.Post,
    url,
  } satisfies HttpRequest;
  const response = await httpRequestFlow.send(request);

  const expectedData = `${firstDataKey}=${firstDataValue}&${secondDataKey}=${secondDataValue}`;
  expect(await httpRequestFlow.get(url)).toMatchObject(request);
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    data: expectedData,
    headers: expect.objectContaining({
      [headerName.toLowerCase()]: `${firstHeaderValue}, ${secondHeaderValue}`,
    }),
  });
});
