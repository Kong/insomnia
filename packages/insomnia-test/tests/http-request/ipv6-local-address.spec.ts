import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ContentType } from "@package/enums/content-type";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";

const url = "http://[::1]:4060/post";

test("Verify HTTP request succeeds against a local IPv6 address", async ({
  user,
}) => {
  const { httpRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const bodyText = faker.string.alphanumeric(10);
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: url,
    body: { mimeType: ContentType.Plain, text: bodyText },
  });
  const responseView = await httpRequestFlow.send(request!);

  expect(responseView.statusBar.code).toBe(200);
  expect(responseView.statusBar.message).toBe("OK");
  expect(responseView.preview).toMatchObject({ data: bodyText });
});
