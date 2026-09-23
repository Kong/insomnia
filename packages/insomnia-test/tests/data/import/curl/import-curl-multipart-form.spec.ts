import path from "node:path";

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
const title = faker.string.alphanumeric(8);
const uploadFilePath = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "misc",
  "fixtures",
  "upload-sample.txt",
);
const command = `curl -X POST "${url}" -F "title=${title}" -F "upload=@${uploadFilePath}"`;

test("Import HTTP Request by Curl Command With -F Builds a Multipart Form Body Including a File Field", async ({
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
  const persisted = await httpRequestFlow.get(url);
  const response = await httpRequestFlow.send(request);
  const raw = (response.body as { data: string }).data;

  expect(persisted).toMatchObject(request);
  expect(persisted?.body?.mimeType).toBe(ContentType.Multipart);
  expect(persisted?.body?.params?.[0]).toMatchObject({
    name: "title",
    value: title,
  });
  expect(persisted?.body?.params?.[1]?.name).toBe("upload");
  expect(persisted?.body?.params?.[1]?.fileName).toContain("upload-sample.txt");
  expect(response.statusCode).toBe(200);
  expect(raw).toContain('name="title"');
  expect(raw).toContain(title);
  expect(raw).toContain('name="upload"; filename="upload-sample.txt"');
  expect(raw).toContain("insomnia-e2e-upload-fixture");
  expect(response.body).toMatchObject({
    headers: expect.objectContaining({
      "content-type": expect.stringContaining(ContentType.Multipart),
    }),
  });
});
