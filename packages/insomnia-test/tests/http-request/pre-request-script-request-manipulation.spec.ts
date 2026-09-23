import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/post`;

test("Verify pre-request script manipulates request headers and body via insomnia.request", async ({
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

  const headerValue = faker.string.alphanumeric(10);
  const rawContent = faker.string.alphanumeric(10);
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    preRequestScript: `
      const { Header } = require('insomnia-collection');
      insomnia.request.headers.add(new Header({ key: 'X-Hello', value: '${headerValue}' }));
      insomnia.request.body.update({ mode: 'raw', raw: '${rawContent}' });
    `,
  });
  const response = await httpRequestFlow.send(request);

  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    data: rawContent,
    headers: expect.objectContaining({ "x-hello": headerValue }),
  });
});

test("Verify pre-request script sets bearer auth via insomnia.request.auth", async ({
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

  const token = faker.string.alphanumeric(10);
  const prefix = faker.string.alpha(8);
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    preRequestScript: `
      insomnia.request.auth.update({
        type: 'bearer',
        bearer: [
          { key: 'token', value: '${token}' },
          { key: 'prefix', value: '${prefix}' },
        ],
      }, 'bearer');
    `,
  });
  const response = await httpRequestFlow.send(request);

  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    headers: expect.objectContaining({
      authorization: `${prefix} ${token}`,
    }),
  });
});

test("Verify pre-request script sets basic auth via insomnia.request.auth", async ({
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

  const username = faker.string.alphanumeric(10);
  const password = faker.string.alphanumeric(10);
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    preRequestScript: `
      insomnia.request.auth.update({
        type: 'basic',
        basic: [
          { key: 'username', value: '${username}' },
          { key: 'password', value: '${password}' },
        ],
      }, 'basic');
    `,
  });
  const response = await httpRequestFlow.send(request);

  const expectedEncodedCredentials = Buffer.from(
    `${username}:${password}`,
    "utf8",
  ).toString("base64");
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    headers: expect.objectContaining({
      authorization: `Basic ${expectedEncodedCredentials}`,
    }),
  });
});
