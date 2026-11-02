import { faker } from "@faker-js/faker";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { HTTP_SERVER, HTTP_SERVER_HTTPS, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify Secure Cookie Is Sent Over HTTPS But Not Over Plain HTTP", async ({
  user,
}) => {
  test.fail(true, 'INS-3179');

  const { cookieFlow, httpRequestFlow, workspaceFlow, preferencesFlow } =
    user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  await preferencesFlow.set({ validateSSL: false });

  const httpRequest = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/cookies`,
  });
  const httpsRequest = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER_HTTPS}/cookies`,
  });

  const secureCookie = {
    key: faker.string.alphanumeric(8),
    value: faker.string.alphanumeric(8),
    domain: "localhost",
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
