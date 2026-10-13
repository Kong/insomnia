import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/cookies`;

test("Verify __Host- Prefixed Cookie Is Only Sent When Marked HostOnly", async ({
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

  const hostOnlyCookie = {
    key: `__Host-${faker.string.alphanumeric(8)}`,
    value: faker.string.alphanumeric(8),
    domain: "localhost",
    path: "/",
    secure: true,
    hostOnly: true,
  };
  const nonHostOnlyCookie = {
    key: `__Host-${faker.string.alphanumeric(8)}`,
    value: faker.string.alphanumeric(8),
    domain: "localhost",
    path: "/",
    secure: true,
  };
  await cookieFlow.link(request, [hostOnlyCookie, nonHostOnlyCookie]);

  const response = await httpRequestFlow.send(request);

  const { cookies } = response.body as { cookies: Record<string, string> };
  expect(cookies).toMatchObject({
    [hostOnlyCookie.key]: hostOnlyCookie.value,
  });
  expect(cookies).not.toHaveProperty(nonHostOnlyCookie.key);
});
