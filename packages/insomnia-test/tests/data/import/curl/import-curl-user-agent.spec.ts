import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../../../enums/http-method";
import { ProjectType } from "../../../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../../../misc/fixtures";
import { Collection } from "../../../../models/collection";
import type { CurlCommand } from "../../../../models/curl-command";
import type { HttpRequest } from "../../../../models/http-request";
import { Project } from "../../../../models/project";

const url = `${HTTP_SERVER}/post`;

test("Import HTTP Request by Curl Command: -A Shorthand Is Ignored, Default User-Agent Is Sent", async ({
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

  const shorthandAgent = `custom-agent-${faker.string.alphanumeric(8)}`;
  const command = `curl -X POST -A "${shorthandAgent}" "${url}"`;
  const curl: CurlCommand = { command };
  await importFlow.importCurl(project, collection, curl);

  const request = {
    name: url,
    method: HttpMethod.Post,
    url,
  } satisfies HttpRequest;
  const response = await httpRequestFlow.send(request);

  expect(await httpRequestFlow.get(url)).toMatchObject(request);
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    headers: expect.objectContaining({
      "user-agent": expect.stringMatching(/^insomnia\//),
    }),
  });
});

test("Import HTTP Request by Curl Command With Explicit -H User-Agent Header Is Honored", async ({
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

  const explicitAgent = `custom-agent-${faker.string.alphanumeric(8)}`;
  const command = `curl -X POST -H "User-Agent: ${explicitAgent}" "${url}"`;
  const curl: CurlCommand = { command };
  await importFlow.importCurl(project, collection, curl);

  const request = {
    name: url,
    method: HttpMethod.Post,
    url,
  } satisfies HttpRequest;
  const response = await httpRequestFlow.send(request);

  expect(await httpRequestFlow.get(url)).toMatchObject(request);
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    headers: expect.objectContaining({ "user-agent": explicitAgent }),
  });
});
