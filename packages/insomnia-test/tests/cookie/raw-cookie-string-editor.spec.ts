import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/cookies`;

test("Verify Editing A Cookie Via The Raw Tab Updates Its Fields And Is Sent", async ({
  user,
}) => {
  const { cookieFlow, httpRequestFlow, workspaceFlow } = user.flowManager;
  const { cookiePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url,
  });

  const key = faker.string.alphanumeric(8);
  const oldValue = faker.string.alphanumeric(8);
  const newValue = faker.string.alphanumeric(8);
  await cookieFlow.link(request, [
    { key, value: oldValue, domain: "example.org", path: "/" },
  ]);

  await cookiePage.open();
  await cookiePage.editCookieRaw(key, `${key}=${newValue}; Domain=localhost; Path=/`);
  const cookiesWhileOpen = await cookiePage.getCookies();
  await cookiePage.close();

  const response = await httpRequestFlow.send(request);
  const { cookies: sentCookies } = response.body as {
    cookies: Record<string, string>;
  };

  expect(cookiesWhileOpen).toMatchObject([
    { key, value: newValue, domain: "localhost", path: "/" },
  ]);
  expect(sentCookies).toEqual({ [key]: newValue });
});
