import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../../../enums/http-method";
import { ProjectType } from "../../../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../../../misc/fixtures";
import { EnvironmentKvPairDataType } from "../../../../models/environment";
import { Project } from "../../../../models/project";

test("Import OpenAPI Spec by Url", async ({ user }) => {
  const {
    importFlow,
    workspaceFlow,
    httpRequestFlow,
    environmentFlow,
    cookieFlow,
  } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importUrl(project, `${HTTP_SERVER}/v2/swagger.json`);

  const petId = faker.number.bigInt(10_000).toString();

  const environment = await environmentFlow.create(project, {
    name: faker.string.alphanumeric(10),
    kvPairData: [
      {
        id: "",
        name: "petId",
        value: petId,
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
      {
        id: "",
        name: "api_key",
        value: faker.string.alphanumeric(10),
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
    ],
  });

  const collection = await workspaceFlow.getCollectionSpec(
    "Swagger Petstore 1.0.7",
  );

  await environmentFlow.link(collection!, environment);

  const request = await httpRequestFlow.get("Find pet by ID", collection);

  const cookieList = await cookieFlow.link(request!, [
    {
      key: faker.string.alphanumeric(8),
      value: faker.string.alphanumeric(8),
      domain: "localhost",
      path: "/",
    },
    {
      key: faker.string.alphanumeric(8),
      value: faker.string.alphanumeric(8),
      domain: "localhost",
      path: "/",
    },
    {
      key: faker.string.alphanumeric(8),
      value: faker.string.alphanumeric(8),
      domain: "example.org",
      path: "/",
    },
  ]);
  const spec = collection!.specification!;
  expect(spec.info).toMatchObject({
    title: "Swagger Petstore",
    version: "1.0.7",
    description: expect.stringContaining("sample server Petstore server"),
  });
  expect(spec.info.license?.name).toEqual("Apache 2.0");
  expect(Object.keys(spec.paths["/pet/{petId}"] ?? {})).toEqual(
    expect.arrayContaining([
      HttpMethod.Get.toLowerCase(),
      HttpMethod.Post.toLowerCase(),
      HttpMethod.Delete.toLowerCase(),
    ]),
  );

  const response = await httpRequestFlow.send(request!);
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    id: Number(petId),
    name: "doggie",
    status: "available",
  });

  const { cookies } = response.body as { cookies: Record<string, string> };
  expect(Object.keys(cookies)).toHaveLength(2);

  const expectedCookies = Object.fromEntries(
    cookieList
      .filter((cookie) => cookie.domain === "localhost")
      .map((cookie) => [cookie.key, cookie.value]),
  );
  expect(cookies).toMatchObject(expectedCookies);
});
