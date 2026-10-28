import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/cookies`;

test("Verify Re-Linking Same Cookie Key Overwrites Previous Value", async ({
  user,
}) => {
  const { cookieFlow, httpRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url,
  });

  const key = faker.string.alphanumeric(8);
  const staleValue = faker.string.alphanumeric(8);
  const freshValue = faker.string.alphanumeric(8);
  await cookieFlow.link(request, [
    { key, value: staleValue, domain: "localhost", path: "/" },
  ]);
  const cookieList = await cookieFlow.link(request, [
    { key, value: freshValue, domain: "localhost", path: "/" },
  ]);

  const responseView = await httpRequestFlow.send(request);

  const { cookies } = responseView.body as { cookies: Record<string, string> };
  expect(cookieList.filter((cookie) => cookie.key === key)).toHaveLength(1);
  expect(cookieList).toMatchObject([{ key, value: freshValue }]);
  expect(cookies).toMatchObject({ [key]: freshValue });
});
