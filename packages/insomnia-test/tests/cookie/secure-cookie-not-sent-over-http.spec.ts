import { faker } from "@faker-js/faker";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import {
  HTTP_SERVER,
  HTTP_SERVER_HTTPS,
  RESOLVING_PROXY_HOST,
  RESOLVING_PROXY_SERVER,
  test,
} from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

// Insomnia treats `localhost` as a secure context and sends Secure cookies over
// plain http, so reach the echo server as `insomnia.test` through the resolving proxy.
const HTTP_URL = HTTP_SERVER.replace("localhost", RESOLVING_PROXY_HOST);
const HTTPS_URL = HTTP_SERVER_HTTPS.replace("localhost", RESOLVING_PROXY_HOST);

test("Verify Secure Cookie Is Sent Over HTTPS But Not Over Plain HTTP", async ({
  user,
}) => {
  const { cookieFlow, httpRequestFlow, workspaceFlow, preferencesFlow } =
    user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  await preferencesFlow.set({
    validateSSL: false,
    proxyEnabled: true,
    httpProxy: RESOLVING_PROXY_SERVER,
    httpsProxy: RESOLVING_PROXY_SERVER,
    noProxy: "",
  });

  const httpRequest = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_URL}/cookies`,
  });
  const httpsRequest = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTPS_URL}/cookies`,
  });

  const secureCookie = {
    key: faker.string.alphanumeric(8),
    value: faker.string.alphanumeric(8),
    domain: RESOLVING_PROXY_HOST,
    path: "/",
    secure: true,
  };
  await cookieFlow.link(httpRequest, [secureCookie]);

  const httpsResponse = await httpRequestFlow.send(httpsRequest);
  expect(httpsResponse.statusBar.code).toBe(200);
  const { cookies: httpsCookies } = httpsResponse.preview as {
    cookies: Record<string, string>;
  };
  expect(httpsCookies).toMatchObject({
    [secureCookie.key]: secureCookie.value,
  });

  const httpResponse = await httpRequestFlow.send(httpRequest);
  const { cookies: httpCookies } = httpResponse.preview as {
    cookies: Record<string, string>;
  };
  expect(httpCookies).not.toHaveProperty(secureCookie.key);
});
