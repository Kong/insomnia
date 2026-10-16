import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

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
  const { workspacePage } = user.pageManager;
  const s = buildSpec();

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await workspaceFlow.create(
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

  const infoKeys = await workspacePage.getOutlineEntryKeys("info");
  const serverKeys = await workspacePage.getOutlineEntryKeys("servers");
  const pathKeys = await workspacePage.getOutlineEntryKeys("paths");
  const schemaKeys = await workspacePage.getOutlineEntryKeys("schemas");
  const parameterKeys = await workspacePage.getOutlineEntryKeys("parameters");
  const securityKeys = await workspacePage.getOutlineEntryKeys("securitySchemes");

  await workspacePage.clickOutlineEntry("info", "title");
  const infoTitle = await workspacePage.getEditorSelection();
  await workspacePage.clickOutlineEntry("info", "license");
  const infoLicense = await workspacePage.getEditorSelection();
  await workspacePage.clickOutlineEntry("servers", 1);
  const server = await workspacePage.getEditorSelection();
  await workspacePage.clickOutlineEntry("paths", s.pathB);
  const pathRow = await workspacePage.getEditorSelection();
  await workspacePage.clickOutlineEntry("paths", s.pathA, HttpMethod.Post);
  const pathMethod = await workspacePage.getEditorSelection();
  await workspacePage.clickOutlineEntry("schemas", s.schemaB);
  const schema = await workspacePage.getEditorSelection();
  await workspacePage.clickOutlineEntry("parameters", s.parameter);
  const parameter = await workspacePage.getEditorSelection();
  await workspacePage.clickOutlineEntry("securitySchemes", s.securityScheme);
  const security = await workspacePage.getEditorSelection();

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
  const { workspacePage } = user.pageManager;
  const s = buildSpec();

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await workspaceFlow.create(
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

  const infoKeys = await workspacePage.getOutlineEntryKeys("info");
  const serverKeys = await workspacePage.getOutlineEntryKeys("servers");
  const pathKeys = await workspacePage.getOutlineEntryKeys("paths");
  const schemaKeys = await workspacePage.getOutlineEntryKeys("schemas");
  const parameterKeys = await workspacePage.getOutlineEntryKeys("parameters");
  const securityKeys = await workspacePage.getOutlineEntryKeys("securitySchemes");

  await workspacePage.clickOutlineEntry("info", "license");
  const infoLicense = await workspacePage.getEditorSelection();
  await workspacePage.clickOutlineEntry("servers", 1);
  const server = await workspacePage.getEditorSelection();
  await workspacePage.clickOutlineEntry("paths", s.pathB);
  const pathRow = await workspacePage.getEditorSelection();
  await workspacePage.clickOutlineEntry("paths", s.pathA, HttpMethod.Post);
  const pathMethod = await workspacePage.getEditorSelection();
  await workspacePage.clickOutlineEntry("schemas", s.schemaB);
  const schema = await workspacePage.getEditorSelection();
  await workspacePage.clickOutlineEntry("parameters", s.parameter);
  const parameter = await workspacePage.getEditorSelection();
  await workspacePage.clickOutlineEntry("securitySchemes", s.securityScheme);
  const security = await workspacePage.getEditorSelection();

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
  const { workspacePage } = user.pageManager;
  const title = faker.commerce.productName();
  const version = faker.system.semver();

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await workspaceFlow.create(
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

  await workspacePage.clickOutlineEntry("info", "title");
  const infoTitle = await workspacePage.getEditorSelection();
  await workspacePage.clickOutlineEntry("info", "version");
  const infoVersion = await workspacePage.getEditorSelection();

  expect(infoTitle.text).toBe(`title: ${title}`);
  expect(infoVersion.text).toBe(`version: ${version}`);
});
