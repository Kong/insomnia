import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/cookies`;

test("Verify Linked Cookie Is Sent With HTTP Request", async ({ user }) => {
  const { cookieFlow, httpRequestFlow, workspaceFlow } = user.flowManager;

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

  const cookieList = await cookieFlow.link(request, [
    {
      key: faker.string.alphanumeric(8),
      value: faker.string.alphanumeric(8),
      domain: "localhost",
      path: "/",
    },
    {
      key: faker.string.alphanumeric(8),
      value: faker.string.alphanumeric(8),
      domain: "localhost",
      path: "/",
    },
    {
      key: faker.string.alphanumeric(8),
      value: faker.string.alphanumeric(8),
      domain: "example.org",
      path: "/",
    },
  ]);

  const response = await httpRequestFlow.send(request);
  expect(response.statusCode).toBe(200);

  const { cookies } = response.body as { cookies: Record<string, string> };
  expect(Object.keys(cookies)).toHaveLength(2);

  const expectedCookies = Object.fromEntries(
    cookieList
      .filter((cookie) => cookie.domain === "localhost")
      .map((cookie) => [cookie.key, cookie.value]),
  );
  expect(cookies).toMatchObject(expectedCookies);
});
