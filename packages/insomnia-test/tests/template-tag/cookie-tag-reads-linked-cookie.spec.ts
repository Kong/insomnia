import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify the cookie Tag Reads a Value from a Linked Cookie", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, cookieFlow, templateTagFlow } =
    user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const cookieTag = `{% cookie '${HTTP_SERVER}', 'session' %}`;
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/${cookieTag}`,
  });

  const cookieValue = faker.string.alphanumeric(10);
  await cookieFlow.link(collection, [
    { key: "session", value: cookieValue, domain: "localhost", path: "/" },
  ]);
  await httpRequestFlow.get(request!.name);
  const tag = await templateTagFlow.get(cookieTag);

  expect(tag.preview).toBe(cookieValue);
});
