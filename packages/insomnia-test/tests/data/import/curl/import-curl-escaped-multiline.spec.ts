import { faker } from "@faker-js/faker";

import { ContentType } from "../../../../enums/content-type";
import { HttpMethod } from "../../../../enums/http-method";
import { ProjectType } from "../../../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../../../misc/fixtures";
import { Collection } from "../../../../models/collection";
import type { CurlCommand } from "../../../../models/curl-command";
import type { HttpRequest } from "../../../../models/http-request";
import { Project } from "../../../../models/project";

const url = `${HTTP_SERVER}/post`;
const headerName = "X-Custom";
const headerValue = `say "${faker.string.alphanumeric(6)}"`;
const escapedHeaderValue = headerValue.replace(/"/g, '\\"');
const title = `hello "${faker.string.alphanumeric(6)}"`;
const note = `line1\nline2-${faker.string.alphanumeric(6)}`;
const body = JSON.stringify({ title, note, userId: 1 });

const command = `curl -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -H "${headerName}: ${escapedHeaderValue}" \\
  -d '${body}'`;

test("Import HTTP Request by Curl Command With Line Continuation and Escaped Characters", async ({
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
    url: url,
    body: { mimeType: ContentType.JSON, text: body },
  } satisfies HttpRequest;
  expect(await httpRequestFlow.get(url)).toMatchObject(request);

  const response = await httpRequestFlow.send(request);
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    data: body,
    json: { title, note, userId: 1 },
    headers: expect.objectContaining({
      [headerName.toLowerCase()]: headerValue,
    }),
  });
});
