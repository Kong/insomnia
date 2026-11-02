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
const body = `{"title": "${faker.string.alphanumeric(8)}"}`;
const command = `curl -X QUERY "${url}" -H "Content-Type: application/json" -d '${body}'`;

test("Verify sending a QUERY request with a body", async ({ user }) => {
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

  const imported = await httpRequestFlow.get(url);
  const responseView = await httpRequestFlow.send(imported!);

  expect(imported).toMatchObject({
    name: url,
    url,
    method: HttpMethod.Query,
    body: { mimeType: ContentType.JSON, text: body },
  } satisfies HttpRequest);
  expect(responseView.statusBar.code).toBe(200);
  expect(responseView.preview).toMatchObject({ data: body });
});
