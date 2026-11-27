import path from "node:path";

import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

const FIXTURE = path.join(import.meta.dirname, "collection-level-properties.yaml");
const FIXTURE_COLLECTION_NAME = "Collection Level Properties";
const REQUEST_NAME = "Echo Request";

const EXPECTED_HEADER = { name: "x-collection", value: "c" };
const EXPECTED_PRE_REQUEST = "insomnia.request.headers.add({ key: 'x-from-collection-script', value: 'yes' });";
const EXPECTED_AFTER_RESPONSE = "console.log('collection after-response script');";
const EXPECTED_AUTHORIZATION = `Basic ${Buffer.from("collection-user:collection-pass").toString("base64")}`;

test("Importing a file with collection-level properties into an existing collection", async ({ user }) => {
  // Remove once the INS-4322 fix reaches this branch (ticket is Ready For Release, but not in develop yet).
  test.fail(true, "INS-4322");
  const { workspaceFlow, collectionFlow, importFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const target = await workspaceFlow.createCollection(project, new Collection(faker.string.alphanumeric(10)));

  await importFlow.importFileIntoCollection(project, target.name, FIXTURE);

  const request = await httpRequestFlow.get(REQUEST_NAME);
  expect(request, "the file's request is imported into the existing collection").toBeTruthy();
  expect(
    await workspaceFlow.getCollection(FIXTURE_COLLECTION_NAME),
    "no new collection is created from the file",
  ).toBeUndefined();

  const collectionPage = await collectionFlow.open(target);

  expect.soft(await collectionPage.headers.getHeaders(), "collection headers").toEqual(
    expect.arrayContaining([expect.objectContaining(EXPECTED_HEADER)]),
  );
  expect.soft(await collectionPage.getHeadersBadge(), "headers badge counts the enabled headers").toBe(1);

  expect.soft(await collectionPage.hasActiveDot("auth"), "auth tab shows an authentication is set").toBe(true);

  expect.soft(await collectionPage.hasActiveDot("scripts"), "scripts tab shows a script is set").toBe(true);
  const scripts = await collectionPage.scripts.getScripts();
  expect.soft(scripts?.preRequest?.trim(), "collection pre-request script").toBe(EXPECTED_PRE_REQUEST);
  expect.soft(scripts?.afterResponse?.trim(), "collection after-response script").toBe(EXPECTED_AFTER_RESPONSE);

  const response = await httpRequestFlow.send(request!);
  expect.soft(response.statusBar.code).toBe(200);
  const sent = (response.preview as { headers?: Record<string, string> } | undefined)?.headers ?? {};
  expect.soft(sent["x-collection"], "collection header is sent").toBe(EXPECTED_HEADER.value);
  expect.soft(sent["x-from-collection-script"], "header added by the collection pre-request script is sent").toBe("yes");
  expect.soft(sent.authorization, "collection Basic auth is sent").toBe(EXPECTED_AUTHORIZATION);
  await expect
    .configure({ soft: true })
    .poll(() => response.console(), { timeout: DEFAULT_TIMEOUT, message: "collection after-response script ran" })
    .toContain("collection after-response script");
});
