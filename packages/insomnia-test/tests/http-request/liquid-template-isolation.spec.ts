import { faker } from "@faker-js/faker";

import { ContentType } from "../../enums/content-type";
import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { EnvironmentKvPairDataType } from "../../models/environment";
import type { HttpRequest } from "../../models/http-request";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/post`;

test("Verify LiquidJS control flow tags render correctly", async ({ user }) => {
  const { environmentFlow, httpRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const envValue = faker.string.alphanumeric(8);
  const environment = await environmentFlow.create(project, {
    name: "Base Environment",
    kvPairData: [
      {
        id: "",
        name: "envVar",
        value: envValue,
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
    ],
  });
  await environmentFlow.link(collection, environment);

  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    body: {
      mimeType: ContentType.Plain,
      text: `{{ envVar }}-{% assign x = 5 %}{% if x > 3 %}big{% else %}small{% endif %}-{% for i in (1..3) %}{{ i }}{% endfor %}-{% unless x == 5 %}no{% else %}yes{% endunless %}`,
    },
  } satisfies HttpRequest);
  const response = await httpRequestFlow.send(request);

  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    data: `${envValue}-big-123-yes`,
  });
});

test("Verify LiquidJS include/render/layout tags are blocked", async ({
  user,
}) => {
  const { httpRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const includeRequest = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    body: { mimeType: ContentType.Plain, text: `{% include 'foo' %}` },
  } satisfies HttpRequest);
  const renderRequest = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    body: { mimeType: ContentType.Plain, text: `{% render 'foo' %}` },
  } satisfies HttpRequest);
  const layoutRequest = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    body: { mimeType: ContentType.Plain, text: `{% layout 'foo' %}` },
  } satisfies HttpRequest);

  const blockedTagPattern = /include.*render.*layout.*disabled/is;

  await expect(httpRequestFlow.send(includeRequest)).rejects.toThrow(
    blockedTagPattern,
  );
  await workspaceFlow.closeDialog();

  await expect(httpRequestFlow.send(renderRequest)).rejects.toThrow(
    blockedTagPattern,
  );
  await workspaceFlow.closeDialog();

  await expect(httpRequestFlow.send(layoutRequest)).rejects.toThrow(
    blockedTagPattern,
  );
  await workspaceFlow.closeDialog();
});
