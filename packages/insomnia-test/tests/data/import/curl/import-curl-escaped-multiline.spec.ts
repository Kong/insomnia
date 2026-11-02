import { faker } from "@faker-js/faker";
import { ContentType } from "@package/enums/content-type";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { HTTP_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import type { CurlCommand } from "@package/models/curl-command";
import type { HttpRequest } from "@package/models/http-request";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

const url = `${HTTP_SERVER}/post`;
const headerName = "X-Custom";
const headerValue = `say "${faker.string.alphanumeric(6)}"`;
const escapedHeaderValue = headerValue
  .replace(/\\/g, "\\\\")
  .replace(/"/g, '\\"');
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
    url: url,
    body: { mimeType: ContentType.JSON, text: body },
  } satisfies HttpRequest;
  expect(await httpRequestFlow.get(url)).toMatchObject(request);

  const responseView = await httpRequestFlow.send(request);
  expect(responseView.statusBar.code).toBe(200);
  expect(responseView.preview).toMatchObject({
    data: body,
    json: { title, note, userId: 1 },
    headers: expect.objectContaining({
      [headerName.toLowerCase()]: headerValue,
    }),
  });
});
