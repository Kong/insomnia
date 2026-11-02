import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { HTTP_SERVER, HTTP_SERVER_HTTPS, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";

test("Verify HttpOnly Cookie Flag Persists And Cookie Is Always Sent Over HTTP And HTTPS", async ({
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

  const httpOnlyCookie = {
    key: faker.string.alphanumeric(8),
    value: faker.string.alphanumeric(8),
    domain: "localhost",
    path: "/",
    httpOnly: true,
  };
  const cookieList = await cookieFlow.link(httpRequest, [httpOnlyCookie]);

  const httpResponse = await httpRequestFlow.send(httpRequest);
  const httpsResponse = await httpRequestFlow.send(httpsRequest);

  expect(httpResponse.statusBar.code).toBe(200);
  const { cookies: httpCookies } = httpResponse.preview as {
    cookies: Record<string, string>;
  };
  expect(httpCookies).toMatchObject({
    [httpOnlyCookie.key]: httpOnlyCookie.value,
  });
  expect(httpsResponse.statusBar.code).toBe(200);
  const { cookies: httpsCookies } = httpsResponse.preview as {
    cookies: Record<string, string>;
  };
  expect(httpsCookies).toMatchObject({
    [httpOnlyCookie.key]: httpOnlyCookie.value,
  });
  expect(
    cookieList.find((cookie) => cookie.key === httpOnlyCookie.key)?.httpOnly,
  ).toBe(true);
});
