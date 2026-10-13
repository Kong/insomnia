import { faker } from "@faker-js/faker";

import { ContentType } from "../../../../enums/content-type";
import { HttpMethod } from "../../../../enums/http-method";
import { ProjectType } from "../../../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../../../misc/fixtures";
import { Collection } from "../../../../models/collection";
import type { CurlCommand } from "../../../../models/curl-command";
import type { HttpRequest } from "../../../../models/http-request";
import { Project } from "../../../../models/project";

const rawUrl = `${HTTP_SERVER}/post`;
const binaryUrl = `${HTTP_SERVER}/posts`;
const rawBody = `{"title": "${faker.string.alphanumeric(8)}"}`;
const binaryBody = `{"title": "${faker.string.alphanumeric(8)}"}`;
const command = `curl -X POST "${rawUrl}" -H "Content-Type: application/json" --data-raw '${rawBody}' ; curl -X POST "${binaryUrl}" -H "Content-Type: application/json" --data-binary '${binaryBody}'`;

test("Import HTTP Request by Curl Command With --data-raw and --data-binary Both Set a JSON Body", async ({
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
  expect(rawResponse.statusCode).toBe(200);
  expect(rawResponse.body).toMatchObject({ data: rawBody });
  expect(binaryResponse.statusCode).toBe(201);
  expect(binaryResponse.body).toMatchObject(JSON.parse(binaryBody));
});
