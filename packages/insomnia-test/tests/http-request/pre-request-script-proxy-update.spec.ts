import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { DEFAULT_TIMEOUT, HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/post`;

test("Verify pre-request script reads the configured proxy and overrides it via insomnia.request.proxy", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, preferencesFlow } = user.flowManager;

  await preferencesFlow.set({
    timeout: 5000,
    proxyEnabled: true,
    httpProxy: "localhost:1111",
    httpsProxy: "localhost:2222",
    noProxy: "http://a.com,https://b.com",
  });

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    preRequestScript: `
      console.log(insomnia.request.proxy.getProxyUrl());
      insomnia.request.proxy.update({
        host: '127.0.0.1',
        match: '<all_urls>',
        port: 8888,
        tunnel: false,
        authenticate: false,
        username: '',
        password: '',
      });
    `,
  });
  const responseView = await httpRequestFlow.send(request);

  expect(responseView.statusCode).toBeUndefined();
  await expect
    .poll(() => responseView.console?.(), { timeout: DEFAULT_TIMEOUT })
    .toContain("localhost:1111");
  await expect
    .poll(() => responseView.console?.(), { timeout: DEFAULT_TIMEOUT })
    .toContain("Trying 127.0.0.1:8888");
});
