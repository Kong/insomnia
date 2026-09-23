import path from "node:path";

import { faker } from "@faker-js/faker";

import { ContentType } from "../../enums/content-type";
import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import type { HttpRequest } from "../../models/http-request";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/post`;
const uploadFilePath = path.join(
  __dirname,
  "..",
  "..",
  "misc",
  "fixtures",
  "upload-sample.txt",
);

test("Send HTTP Request with x-www-form-urlencoded Body", async ({ user }) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const title = faker.string.alphanumeric(8);
  const userId = faker.string.numeric(3);
  const request = {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    body: {
      mimeType: ContentType.Form,
      params: [
        { name: "title", value: title },
        { name: "userId", value: userId },
        { name: "excluded", value: "should-not-be-sent", disabled: true },
      ],
    },
  } satisfies HttpRequest;

  const persisted = await httpRequestFlow.create(collection, request);
  const response = await httpRequestFlow.send(request);
  const raw = (response.body as { data: string }).data;

  expect(persisted.body?.mimeType).toBe(ContentType.Form);
  expect(persisted.body?.params).toMatchObject([
    { name: "title", value: title },
    { name: "userId", value: userId },
    { name: "excluded", disabled: true },
  ]);
  expect(response.statusCode).toBe(200);
  expect(Object.fromEntries(new URLSearchParams(raw))).toEqual({
    title,
    userId,
  });
  expect(response.body).toMatchObject({
    headers: expect.objectContaining({
      "content-type": expect.stringContaining(ContentType.Form),
    }),
  });
});

test("Send HTTP Request with JSON Body", async ({ user }) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const payload = { title: faker.string.alphanumeric(8), userId: 1 };
  const request = {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    body: { mimeType: ContentType.JSON, text: JSON.stringify(payload) },
  } satisfies HttpRequest;

  await httpRequestFlow.create(collection, request);
  const persisted = await httpRequestFlow.get(request.name);
  const response = await httpRequestFlow.send(request);

  expect(persisted).toMatchObject(request);
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    json: payload,
    headers: expect.objectContaining({
      "content-type": expect.stringContaining(ContentType.JSON),
    }),
  });
});

test("Send HTTP Request with XML Body", async ({ user }) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const title = faker.string.alphanumeric(8);
  const xml = `<note><title>${title}</title></note>`;
  const request = {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    body: { mimeType: ContentType.XML, text: xml },
  } satisfies HttpRequest;

  await httpRequestFlow.create(collection, request);
  const persisted = await httpRequestFlow.get(request.name);
  const response = await httpRequestFlow.send(request);

  expect(persisted).toMatchObject(request);
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    data: xml,
    headers: expect.objectContaining({
      "content-type": expect.stringContaining(ContentType.XML),
    }),
  });
});

test("Send HTTP Request with No Body explicitly selected", async ({ user }) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const request = {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    body: { mimeType: ContentType.NoBody },
  } satisfies HttpRequest;

  await httpRequestFlow.create(collection, request);
  const persisted = await httpRequestFlow.get(request.name);
  const response = await httpRequestFlow.send(request);

  expect(persisted).toMatchObject({
    method: request.method,
    url: request.url,
    body: undefined,
  });
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    data: "",
    json: null,
  });
});

test("Send HTTP Request with multipart/form-data Body including a file field", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const title = faker.string.alphanumeric(8);
  const request = {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    body: {
      mimeType: ContentType.Multipart,
      params: [
        { name: "title", value: title },
        { name: "upload", fileName: uploadFilePath },
      ],
    },
  } satisfies HttpRequest;

  await httpRequestFlow.create(collection, request);
  const persisted = await httpRequestFlow.get(request.name);
  const response = await httpRequestFlow.send(request);
  const raw = (response.body as { data: string }).data;

  expect(persisted?.body?.mimeType).toBe(ContentType.Multipart);
  expect(persisted?.body?.params?.[0]).toMatchObject({
    name: "title",
    value: title,
  });
  expect(persisted?.body?.params?.[1]?.name).toBe("upload");
  expect(persisted?.body?.params?.[1]?.fileName).toContain("upload-sample.txt");
  expect(response.statusCode).toBe(200);
  expect(raw).toContain('name="title"');
  expect(raw).toContain(title);
  expect(raw).toContain('name="upload"; filename="upload-sample.txt"');
  expect(raw).toContain("insomnia-e2e-upload-fixture");
  expect(response.body).toMatchObject({
    headers: expect.objectContaining({
      "content-type": expect.stringContaining(ContentType.Multipart),
    }),
  });
});
