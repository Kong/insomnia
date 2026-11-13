import path from "node:path";

import { faker } from "@faker-js/faker";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { TreeNodeType } from "@package/enums/tree-node-types";
import { test } from "@package/misc/fixtures";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify A Self-Referencing OpenAPI 3.2 Schema Imports With The Example Truncated At The Cycle", async ({
  user,
}) => {
  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "circular-schema.yaml"),
  );

  const create = await httpRequestFlow.get("Create a node");

  expect(create?.method).toBe(HttpMethod.Post);
  expect(JSON.parse(create!.body!.text!)).toEqual({
    value: "string",
    next: { value: "string", next: null },
  });
});

test("Verify OpenAPI 3.2 Security Schemes With oauth2MetadataUrl And Device Authorization Import Without Errors", async ({
  user,
}) => {
  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "security-schemes.yaml"),
  );

  const secured = await httpRequestFlow.get("Secured list");

  expect(secured).toMatchObject({
    method: HttpMethod.Get,
    url: "{{ _.base_url }}/pets",
  });
  // Every operation is imported, including the ones whose only scheme is
  // the device flow or the deprecated key.
  for (const name of [
    "Auth code secured",
    "Device flow secured",
    "Deprecated key secured",
    "Client credentials secured",
  ]) {
    expect(await httpRequestFlow.get(name)).toMatchObject({
      method: HttpMethod.Get,
    });
  }

  // oauth2MetadataUrl is ignored; the first listed scheme (authorization
  // code) drives the Auth tab, even when later schemes are unsupported.
  for (const name of ["Secured list", "Auth code secured"]) {
    expect(await httpRequestFlow.getAuthentication(name)).toEqual({
      type: "OAuth 2.0",
      oauth2: {
        grantType: "authorization_code",
        authorizationUrl: "https://auth.example.com/authorize",
        accessTokenUrl: "https://auth.example.com/token",
        clientId: "{{ _.oauth2ClientId }}",
        scope: "read",
      },
    });
  }

  expect(
    await httpRequestFlow.getAuthentication("Client credentials secured"),
  ).toEqual({
    type: "OAuth 2.0",
    oauth2: {
      grantType: "client_credentials",
      authorizationUrl: undefined,
      accessTokenUrl: "https://auth.example.com/token",
      clientId: "{{ _.oauth2ClientId }}",
      scope: "read",
    },
  });

  // deviceAuthorization has no Insomnia grant type, so the importer sets no
  // Auth and the request keeps the default "Inherit from parent".
  expect(await httpRequestFlow.getAuthentication("Device flow secured")).toEqual(
    { type: "Inherit from parent" },
  );

  // A deprecated apiKey scheme still maps to API Key auth.
  expect(
    await httpRequestFlow.getAuthentication("Deprecated key secured"),
  ).toEqual({ type: "API Key" });
});

test("Verify OpenAPI 3.2 Schema And Tag Keywords Do Not Change The Generated Request", async ({
  user,
}) => {
  test.fail(true, "INS-4291");

  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "schema-and-tag-keywords.yaml"),
  );

  const create = await httpRequestFlow.get("Create an animal");

  expect(create).toMatchObject({
    method: HttpMethod.Post,
    url: "{{ _.base_url }}/pets",
  });
  expect(JSON.parse(create!.body!.text!)).toEqual({
    kind: "string",
    name: "string",
  });

  // `cats` declares `parent: pets`, so it nests under `pets` instead of
  // being a sibling folder.
  const nodes = (await workspacePage.getTree()).flatten();
  const pets = nodes.find(
    (node) => node.type === TreeNodeType.Folder && node.name === "pets",
  );
  const cats = pets?.children.find(
    (node) => node.type === TreeNodeType.Folder && node.name === "cats",
  );
  expect(cats).toBeDefined();
  expect(cats!.children.map((node) => node.name)).toEqual(["Create an animal"]);
});

test("Verify A Structurally Invalid OpenAPI 3.2 Document Still Imports With Its Schema References Resolved", async ({
  user,
}) => {
  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "invalid-structure.yaml"),
  );

  const list = await httpRequestFlow.get("List pets");
  const create = await httpRequestFlow.get("Create a pet");

  expect(list?.method).toBe(HttpMethod.Get);
  expect(create?.method).toBe(HttpMethod.Post);
  expect(JSON.parse(create!.body!.text!)).toEqual({ name: "string" });
});
