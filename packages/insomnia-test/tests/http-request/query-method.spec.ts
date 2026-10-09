import { faker } from "@faker-js/faker";

import { ContentType } from "../../enums/content-type";
import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import type { CurlCommand } from "../../models/curl-command";
import type { HttpRequest } from "../../models/http-request";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/post`;
const body = `{"title": "${faker.string.alphanumeric(8)}"}`;
const command = `curl -X QUERY "${url}" -H "Content-Type: application/json" -d '${body}'`;

test("Verify sending a QUERY request with a body", async ({ user }) => {
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

  const imported = await httpRequestFlow.get(url);
  const response = await httpRequestFlow.send(imported!);

  expect(imported).toMatchObject({
    name: url,
    url,
    method: HttpMethod.Query,
    body: { mimeType: ContentType.JSON, text: body },
  } satisfies HttpRequest);
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({ data: body });
});
