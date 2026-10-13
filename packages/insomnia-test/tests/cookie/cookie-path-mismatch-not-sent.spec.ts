import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/cookies`;

test("Verify Cookie With Mismatched Path Is Not Sent With HTTP Request", async ({
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

  const mismatchedCookie = {
    key: faker.string.alphanumeric(8),
    value: faker.string.alphanumeric(8),
    domain: "localhost",
    path: "/foo",
  };
  const matchedCookie = {
    key: faker.string.alphanumeric(8),
    value: faker.string.alphanumeric(8),
    domain: "localhost",
    path: "/",
  };
  await cookieFlow.link(request, [mismatchedCookie, matchedCookie]);

  const response = await httpRequestFlow.send(request);

  const { cookies } = response.body as { cookies: Record<string, string> };
  expect(cookies).not.toHaveProperty(mismatchedCookie.key);
  expect(cookies).toMatchObject({ [matchedCookie.key]: matchedCookie.value });
});
