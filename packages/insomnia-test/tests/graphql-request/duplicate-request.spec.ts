import { faker } from "@faker-js/faker";
import { ContentType } from "@package/enums/content-type";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { HTTP_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

const query = "{ characters { results { name } } }";
const body = { mimeType: ContentType.JSON, text: JSON.stringify({ query }) };

test("Verify Duplicated GraphQL Request Keeps Url, Body and Headers", async ({
  user,
}) => {
  const { graphqlRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const headerValue = faker.string.alphanumeric(10);
  const request = await graphqlRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post`,
    body,
    headers: [{ name: "X-Custom", value: headerValue }],
  });
  const duplicatedName = `${request.name} (Copy)`;
  await workspaceFlow.duplicateRequest(request, duplicatedName);

  const duplicated = await graphqlRequestFlow.get(duplicatedName);
  const responseView = await graphqlRequestFlow.send(duplicated!);

  expect(duplicated).toBeTruthy();
  expect(duplicated!.url).toBe(request.url);
  expect(duplicated!.body!.text).toBe(request.body!.text);
  expect(responseView.preview).toMatchObject({
    headers: expect.objectContaining({ "x-custom": headerValue }),
  });
});
