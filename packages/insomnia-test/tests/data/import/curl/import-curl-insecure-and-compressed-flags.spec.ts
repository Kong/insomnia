import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { HTTP_SERVER_HTTPS, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import type { CurlCommand } from "@package/models/curl-command";
import type { HttpRequest } from "@package/models/http-request";
import { Project } from "@package/models/project";

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
    url,
  } satisfies HttpRequest;
  const responseView = await httpRequestFlow.send(request);

  expect(await httpRequestFlow.get(url)).toMatchObject(request);
  expect(responseView.statusBar.code).toBe(200);
  expect(responseView.preview).toMatchObject({ data: `${dataKey}=${dataValue}` });
});
