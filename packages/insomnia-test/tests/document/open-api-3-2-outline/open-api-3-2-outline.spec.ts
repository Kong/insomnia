import { readFileSync } from "node:fs";
import path from "node:path";

import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

const readSpec = (fileName: string) =>
  readFileSync(path.join(import.meta.dirname, fileName), "utf8");

test("Verify The Sidebar Shows Method Badges For query, additionalOperations And Path Item $ref Methods", async ({
  user,
}) => {
  const { specFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10), readSpec("paths.json")),
  );
  const petsBadges = await specFlow.getPathMethodBadges("/pets");
  const petItemBadges = await specFlow.getPathMethodBadges("/pets/{id}");
  const querySelection = await specFlow.jumpToPathMethod("/pets", "QUERY");
  const purgeSelection = await specFlow.jumpToPathMethod("/pets", "PURGE");
  const refSelection = await specFlow.jumpToPathMethod("/pets/{id}", "GET");

  expect(petsBadges).toEqual([
    { method: "QUERY", label: "QRY" },
    { method: "PURGE", label: "PRG" },
  ]);
  expect(petItemBadges).toEqual([{ method: "GET", label: "GET" }]);
  expect(querySelection.text).toContain('"query"');
  expect(purgeSelection.text).toContain('"PURGE"');
  expect(refSelection.text).toContain('"get"');
});

test("Verify The Sidebar Shows The Same Method Badges For An OpenAPI 3.0 Spec", async ({
  user,
}) => {
  const { specFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await workspaceFlow.createCollection(
    project,
    new Collection(
      faker.string.alphanumeric(10),
      JSON.stringify({
        openapi: "3.0.0",
        info: { title: faker.commerce.productName(), version: "1.0.0" },
        paths: {
          "/pets": {
            get: { responses: { "200": { description: "OK" } } },
            post: { responses: { "200": { description: "OK" } } },
          },
        },
      }),
    ),
  );
  const badges = await specFlow.getPathMethodBadges("/pets");

  expect(badges).toEqual([
    { method: "GET", label: "GET" },
    { method: "POST", label: "POST" },
  ]);
});

test("Verify The Webhooks Sidebar Section Lists Dotted Names And Path Item $ref Webhooks And Jumps To Them", async ({
  user,
}) => {
  const { specFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await workspaceFlow.createCollection(
    project,
    new Collection(
      faker.string.alphanumeric(10),
      readSpec("webhooks-only.json"),
    ),
  );
  const webhooks = await specFlow.getWebhooks();
  const rowSelection = await specFlow.jumpToWebhook("pet.created");
  const badgeSelection = await specFlow.jumpToWebhookMethod(
    "pet.updated",
    "POST",
  );

  expect(webhooks).toEqual([
    { name: "pet.created", methods: ["POST"] },
    { name: "pet.updated", methods: ["POST"] },
  ]);
  expect(rowSelection.text).toContain('"pet.created"');
  expect(badgeSelection.text).toContain('"post"');
});
