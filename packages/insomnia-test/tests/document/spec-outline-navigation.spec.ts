import { faker } from "@faker-js/faker";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

const buildSpec = () => ({
  title: faker.commerce.productName(),
  serverA: `https://${faker.internet.domainName()}`,
  serverB: `https://${faker.internet.domainName()}`,
  pathA: `/${faker.word.sample()}-a`,
  pathB: `/${faker.word.sample()}-b`,
  schemaA: faker.string.alpha({ length: 8, casing: "upper" }),
  schemaB: faker.string.alpha({ length: 8, casing: "upper" }),
  parameter: faker.string.alpha({ length: 8, casing: "upper" }),
  securityScheme: faker.string.alpha({ length: 8, casing: "upper" }),
});

test("Verify Spec Outline Sidebar Lists Every Section And Jumps To The Matching Line In A JSON Spec", async ({
  user,
}) => {
  const { workspaceFlow } = user.flowManager;
  const { workspacePage, specPage } = user.pageManager;
  const s = buildSpec();

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await workspaceFlow.createCollection(
    project,
    new Collection(
      faker.string.alphanumeric(10),
      JSON.stringify(
        {
          openapi: "3.0.0",
          info: { title: s.title, version: "1.0.0", license: { name: "MIT" } },
          servers: [{ url: s.serverA }, { url: s.serverB }],
          paths: {
            [s.pathA]: {
              get: { responses: { "200": { description: "OK" } } },
              post: { responses: { "200": { description: "OK" } } },
            },
            [s.pathB]: { get: { responses: { "200": { description: "OK" } } } },
          },
          components: {
            schemas: { [s.schemaA]: { type: "object" }, [s.schemaB]: { type: "object" } },
            parameters: {
              [s.parameter]: { name: "limit", in: "query", schema: { type: "integer" } },
            },
            securitySchemes: {
              [s.securityScheme]: { type: "apiKey", name: "key", in: "header" },
            },
          },
        },
        null,
        2,
      ),
    ),
  );

  const infoKeys = await specPage.getOutlineEntryKeys("info");
  const serverKeys = await specPage.getOutlineEntryKeys("servers");
  const pathKeys = await specPage.getOutlineEntryKeys("paths");
  const schemaKeys = await specPage.getOutlineEntryKeys("schemas");
  const parameterKeys = await specPage.getOutlineEntryKeys("parameters");
  const securityKeys = await specPage.getOutlineEntryKeys("securitySchemes");

  await specPage.clickOutlineEntry("info", "title");
  const infoTitle = await specPage.getEditorSelection();
  await specPage.clickOutlineEntry("info", "license");
  const infoLicense = await specPage.getEditorSelection();
  await specPage.clickOutlineEntry("servers", 1);
  const server = await specPage.getEditorSelection();
  await specPage.clickOutlineEntry("paths", s.pathB);
  const pathRow = await specPage.getEditorSelection();
  await specPage.clickOutlineEntry("paths", s.pathA, HttpMethod.Post);
  const pathMethod = await specPage.getEditorSelection();
  await specPage.clickOutlineEntry("schemas", s.schemaB);
  const schema = await specPage.getEditorSelection();
  await specPage.clickOutlineEntry("parameters", s.parameter);
  const parameter = await specPage.getEditorSelection();
  await specPage.clickOutlineEntry("securitySchemes", s.securityScheme);
  const security = await specPage.getEditorSelection();

  expect(infoKeys).toEqual([
    "info.title",
    "info.description",
    "info.version",
    "info.license",
  ]);
  expect(serverKeys).toEqual(["servers.0", "servers.1"]);
  expect(pathKeys).toEqual([`paths.${s.pathA}`, `paths.${s.pathB}`]);
  expect(schemaKeys).toEqual([
    `components.schemas.${s.schemaA}`,
    `components.schemas.${s.schemaB}`,
  ]);
  expect(parameterKeys).toEqual([`components.parameters.${s.parameter}`]);
  expect(securityKeys).toEqual([`components.securitySchemes.${s.securityScheme}`]);
  expect(infoTitle.text).toBe(`"title": "${s.title}",`);
  expect(infoLicense.text).toBe('"license": {');
  expect(server.text).toBe(`"url": "${s.serverB}"`);
  expect(pathRow.text).toBe(`"${s.pathB}": {`);
  expect(pathMethod.text).toBe('"post": {');
  expect(pathMethod.line).toBeLessThan(pathRow.line);
  expect(schema.text).toBe(`"${s.schemaB}": {`);
  expect(parameter.text).toBe(`"${s.parameter}": {`);
  expect(security.text).toBe(`"${s.securityScheme}": {`);
});

test("Verify Spec Outline Sidebar Lists Every Section And Jumps To The Matching Line In A YAML Spec", async ({
  user,
}) => {
  const { workspaceFlow } = user.flowManager;
  const { workspacePage, specPage } = user.pageManager;
  const s = buildSpec();

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await workspaceFlow.createCollection(
    project,
    new Collection(
      faker.string.alphanumeric(10),
      `openapi: 3.0.0
info:
  title: ${s.title}
  version: 1.0.0
  license:
    name: MIT
servers:
  - url: ${s.serverA}
  - url: ${s.serverB}
paths:
  ${s.pathA}:
    get:
      responses:
        '200':
          description: OK
    post:
      responses:
        '200':
          description: OK
  ${s.pathB}:
    get:
      responses:
        '200':
          description: OK
components:
  schemas:
    ${s.schemaA}:
      type: object
    ${s.schemaB}:
      type: object
  parameters:
    ${s.parameter}:
      name: limit
      in: query
      schema:
        type: integer
  securitySchemes:
    ${s.securityScheme}:
      type: apiKey
      name: key
      in: header
`,
    ),
  );

  const infoKeys = await specPage.getOutlineEntryKeys("info");
  const serverKeys = await specPage.getOutlineEntryKeys("servers");
  const pathKeys = await specPage.getOutlineEntryKeys("paths");
  const schemaKeys = await specPage.getOutlineEntryKeys("schemas");
  const parameterKeys = await specPage.getOutlineEntryKeys("parameters");
  const securityKeys = await specPage.getOutlineEntryKeys("securitySchemes");

  await specPage.clickOutlineEntry("info", "license");
  const infoLicense = await specPage.getEditorSelection();
  await specPage.clickOutlineEntry("servers", 1);
  const server = await specPage.getEditorSelection();
  await specPage.clickOutlineEntry("paths", s.pathB);
  const pathRow = await specPage.getEditorSelection();
  await specPage.clickOutlineEntry("paths", s.pathA, HttpMethod.Post);
  const pathMethod = await specPage.getEditorSelection();
  await specPage.clickOutlineEntry("schemas", s.schemaB);
  const schema = await specPage.getEditorSelection();
  await specPage.clickOutlineEntry("parameters", s.parameter);
  const parameter = await specPage.getEditorSelection();
  await specPage.clickOutlineEntry("securitySchemes", s.securityScheme);
  const security = await specPage.getEditorSelection();

  expect(infoKeys).toEqual([
    "info.title",
    "info.description",
    "info.version",
    "info.license",
  ]);
  expect(serverKeys).toEqual(["servers.0", "servers.1"]);
  expect(pathKeys).toEqual([`paths.${s.pathA}`, `paths.${s.pathB}`]);
  expect(schemaKeys).toEqual([
    `components.schemas.${s.schemaA}`,
    `components.schemas.${s.schemaB}`,
  ]);
  expect(parameterKeys).toEqual([`components.parameters.${s.parameter}`]);
  expect(securityKeys).toEqual([`components.securitySchemes.${s.securityScheme}`]);
  expect(infoLicense.text).toBe("license:");
  expect(server.text).toBe(`- url: ${s.serverB}`);
  expect(pathRow.text).toBe(`${s.pathB}:`);
  expect(pathMethod.text).toBe("post:");
  expect(pathMethod.line).toBeLessThan(pathRow.line);
  expect(schema.text).toBe(`${s.schemaB}:`);
  expect(parameter.text).toBe(`${s.parameter}:`);
  expect(security.text).toBe(`${s.securityScheme}:`);
});

test("Verify Spec Outline Sidebar Jumps To The Line Of A Scalar Info Value In A YAML Spec", async ({
  user,
}) => {
  test.fail(true, "INS-4007");

  const { workspaceFlow } = user.flowManager;
  const { workspacePage, specPage } = user.pageManager;
  const title = faker.commerce.productName();
  const version = faker.system.semver();

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await workspaceFlow.createCollection(
    project,
    new Collection(
      faker.string.alphanumeric(10),
      `openapi: 3.0.0
info:
  title: ${title}
  version: ${version}
paths:
  /${faker.word.sample()}:
    get:
      responses:
        '200':
          description: OK
`,
    ),
  );

  await specPage.clickOutlineEntry("info", "title");
  const infoTitle = await specPage.getEditorSelection();
  await specPage.clickOutlineEntry("info", "version");
  const infoVersion = await specPage.getEditorSelection();

  expect(infoTitle.text).toBe(`title: ${title}`);
  expect(infoVersion.text).toBe(`version: ${version}`);
});
