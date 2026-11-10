import { faker } from "@faker-js/faker";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { MOCK_API_SERVER, test } from "@package/misc/fixtures";
import { EnvironmentKvPairDataType } from "@package/models/environment";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Import OpenAPI Spec by Url", async ({ user }, testInfo) => {
  // This test's later cookie-persistence check (CookieFlow.link ->
  // waitForPersisted) polls the on-disk NeDB file for up to DEFAULT_TIMEOUT
  // (60s) on its own, which combined with the import/environment/request
  // setup steps ahead of it has been observed to exceed the default 90s
  // test timeout under CI load. Give the whole test more headroom.
  testInfo.setTimeout(150_000);

  const {
    importFlow,
    workspaceFlow,
    httpRequestFlow,
    environmentFlow,
    cookieFlow,
  } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importUrl(project, `${MOCK_API_SERVER}/http-echo/v2/swagger.json`);

  const petId = faker.number.bigInt(10_000).toString();

  const environment = await environmentFlow.createBaseEnvironment(project, {
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

  const request = await httpRequestFlow.get("Find pet by ID");

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

  const responseView = await httpRequestFlow.send(request!);
  expect(responseView.statusBar.code).toBe(200);
  expect(responseView.preview).toMatchObject({
    id: Number(petId),
    name: "doggie",
    status: "available",
  });

  const { cookies } = responseView.preview as { cookies: Record<string, string> };
  expect(Object.keys(cookies)).toHaveLength(2);

  const expectedCookies = Object.fromEntries(
    cookieList
      .filter((cookie) => cookie.domain === "localhost")
      .map((cookie) => [cookie.key, cookie.value]),
  );
  expect(cookies).toMatchObject(expectedCookies);
});
