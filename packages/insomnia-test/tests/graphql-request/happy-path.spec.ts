import { faker } from "@faker-js/faker";

import { ContentType } from "../../enums/content-type";
import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/graphql`;
const query = '{ characters(filter: {status: "Alive"}) { results { name } } }';
const body = {
  mimeType: ContentType.JSON,
  text: JSON.stringify({ query }),
};
const expectedNames = ["Rick Sanchez", "Morty Smith"];

test("Verify Create GraphQL Request", async ({ user }) => {
  const { graphqlRequestFlow, workspaceFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const request = await graphqlRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: url,
    body: body,
  });
  const response = await graphqlRequestFlow.send(request);
  expect(response.statusCode).toBe(200);
  expect(response.statusMessage).toBe("OK");
  expect(response.headers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "content-type",
        value: expect.stringContaining("application/json"),
      }),
    ]),
  );
  expect(response.body).toMatchObject({
    data: {
      characters: {
        results: expect.arrayContaining(
          expectedNames.map((name) => expect.objectContaining({ name })),
        ),
      },
    },
  });
  const persistedQuery = JSON.parse(request.body!.text!).query as string;
  expect(persistedQuery).not.toBe(query);
  expect(persistedQuery.replace(/\s+/g, " ").trim()).toBe(query);

  await workspaceFlow.delete(project);
  const deletedNames = [request.name, collection.name, project.name];
  await expect
    .poll(
      async () => {
        const names = (await workspacePage.getNodes()).map((node) => node.name);
        return deletedNames.filter((name) => names.includes(name));
      },
      { timeout: 10_000 },
    )
    .toEqual([]);
});
