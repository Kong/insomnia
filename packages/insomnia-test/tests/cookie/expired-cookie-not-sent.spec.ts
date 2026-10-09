import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/cookies`;

test("Verify Expired Cookie Is Not Sent With HTTP Request", async ({
  user,
}) => {
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

  const expiredCookie = {
    key: faker.string.alphanumeric(8),
    value: faker.string.alphanumeric(8),
    domain: "localhost",
    path: "/",
    expires: new Date("2000-01-01T00:00:00"),
  };
  const activeCookie = {
    key: faker.string.alphanumeric(8),
    value: faker.string.alphanumeric(8),
    domain: "localhost",
    path: "/",
  };
  await cookieFlow.link(request, [expiredCookie, activeCookie]);

  const response = await httpRequestFlow.send(request);

  const { cookies } = response.body as { cookies: Record<string, string> };
  expect(cookies).not.toHaveProperty(expiredCookie.key);
  expect(cookies).toMatchObject({ [activeCookie.key]: activeCookie.value });
});
