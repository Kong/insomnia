import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ContentType } from "@package/enums/content-type";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { HTTP_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import type { CurlCommand } from "@package/models/curl-command";
import type { HttpRequest } from "@package/models/http-request";
import { Project } from "@package/models/project";

const rawUrl = `${HTTP_SERVER}/post`;
const binaryUrl = `${HTTP_SERVER}/posts`;
const rawBody = `{"title": "${faker.string.alphanumeric(8)}"}`;
const binaryBody = `{"title": "${faker.string.alphanumeric(8)}"}`;
const command = `curl -X POST "${rawUrl}" -H "Content-Type: application/json" --data-raw '${rawBody}' ; curl -X POST "${binaryUrl}" -H "Content-Type: application/json" --data-binary '${binaryBody}'`;

test("Import HTTP Request by Curl Command With --data-raw and --data-binary Both Set a JSON Body", async ({
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

  const rawRequest = {
    name: rawUrl,
    method: HttpMethod.Post,
    url: rawUrl,
    body: { mimeType: ContentType.JSON, text: rawBody },
  } satisfies HttpRequest;
  const binaryRequest = {
    name: binaryUrl,
    method: HttpMethod.Post,
    url: binaryUrl,
    body: { mimeType: ContentType.JSON, text: binaryBody },
  } satisfies HttpRequest;
  const rawResponse = await httpRequestFlow.send(rawRequest);
  const binaryResponse = await httpRequestFlow.send(binaryRequest);

  expect(await httpRequestFlow.get(rawUrl)).toMatchObject(rawRequest);
  expect(await httpRequestFlow.get(binaryUrl)).toMatchObject(binaryRequest);
  expect(rawResponse.statusBar.code).toBe(200);
  expect(rawResponse.preview).toMatchObject({ data: rawBody });
  expect(binaryResponse.statusBar.code).toBe(201);
  expect(binaryResponse.preview).toMatchObject(JSON.parse(binaryBody));
});
