import { faker } from "@faker-js/faker";

import { ContentType } from "../../enums/content-type";
import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const query = "{ characters { results { name } } }";
const body = { mimeType: ContentType.JSON, text: JSON.stringify({ query }) };

test("Verify Enabling a Proxy Routes GraphQL Requests Through It", async ({
  user,
}) => {
  const { graphqlRequestFlow, preferencesFlow, workspaceFlow } =
    user.flowManager;
  const { responsePage } = user.pageManager;

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
    url: `${HTTP_SERVER}/post`,
    body,
  });

  await preferencesFlow.set({
    proxyEnabled: true,
    httpProxy: "127.0.0.1:1111",
    httpsProxy: "127.0.0.1:2222",
    noProxy: "",
  });

  await graphqlRequestFlow.send(request);
  const consoleText = await responsePage.getConsole();

  expect(consoleText).toContain("Trying 127.0.0.1:1111");
});
