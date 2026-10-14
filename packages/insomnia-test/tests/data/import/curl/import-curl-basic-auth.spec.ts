import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../../../enums/http-method";
import { ProjectType } from "../../../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../../../misc/fixtures";
import { Collection } from "../../../../models/collection";
import type { CurlCommand } from "../../../../models/curl-command";
import type { HttpRequest } from "../../../../models/http-request";
import { Project } from "../../../../models/project";

const url = `${HTTP_SERVER}/post`;
const username = faker.string.alphanumeric(8);
const password = faker.string.alphanumeric(8);
const command = `curl -X POST -u "${username}:${password}" "${url}"`;

test("Import HTTP Request by Curl Command With Basic Auth (-u) Sends Authorization Header", async ({
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
    method: HttpMethod.Post,
    url,
  } satisfies HttpRequest;
  const responseView = await httpRequestFlow.send(request);

  const expectedAuthorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  expect(await httpRequestFlow.get(url)).toMatchObject(request);
  expect(responseView.statusCode).toBe(200);
  expect(responseView.body).toMatchObject({
    headers: expect.objectContaining({
      authorization: expectedAuthorization,
    }),
  });
});
