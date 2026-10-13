import { faker } from "@faker-js/faker";

import { ContentType } from "../../../../enums/content-type";
import { HttpMethod } from "../../../../enums/http-method";
import { ProjectType } from "../../../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../../../misc/fixtures";
import { Collection } from "../../../../models/collection";
import type { CurlCommand } from "../../../../models/curl-command";
import type { HttpRequest } from "../../../../models/http-request";
import { Project } from "../../../../models/project";

const url = `${HTTP_SERVER}/posts`;
const body = `{"title": "title", "body": "body", "userId": 1}`;
const command = `curl -X POST "${url}"
  -H "Content-Type: application/json"
  -d '${body}'`;

test("Import HTTP Request by Curl Command", async ({ user }) => {
  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

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
  expect(response.statusCode).toBe(201);
  expect(response.statusMessage).toBe("Created");
  expect(response.headers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "content-type",
        value: expect.stringContaining("application/json"),
      }),
    ]),
  );

  await workspaceFlow.delete(request);
  const deletedNames = [request.name];
  await expect
    .poll(
      async () => {
        const names = (await workspacePage.getNodes()).map((node) => node.name);
        return deletedNames.filter((name) => names.includes(name));
      },
      { timeout: 10_000 },
    )
    .toEqual([]);
});
