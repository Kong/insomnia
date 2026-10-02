import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../../../enums/http-method";
import { ProjectType } from "../../../../enums/project-types";
import { expect, HTTP_SERVER_HTTPS,test } from "../../../../misc/fixtures";
import { Collection } from "../../../../models/collection";
import type { CurlCommand } from "../../../../models/curl-command";
import type { HttpRequest } from "../../../../models/http-request";
import { Project } from "../../../../models/project";

const url = `${HTTP_SERVER_HTTPS}/post`;
const dataKey = faker.string.alpha(4);
const dataValue = faker.string.alphanumeric(6);
const command = `curl -k --compressed -X POST "${url}" -d "${dataKey}=${dataValue}"`;

test("Import HTTP Request by Curl Command With -k/--insecure and --compressed Flags Does Not Break Import Or Send", async ({
  user,
}) => {
  const { httpRequestFlow, importFlow, preferencesFlow, workspaceFlow } =
    user.flowManager;

  await preferencesFlow.set({ validateSSL: false });

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
  const response = await httpRequestFlow.send(request);

  expect(await httpRequestFlow.get(url)).toMatchObject(request);
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({ data: `${dataKey}=${dataValue}` });
});
