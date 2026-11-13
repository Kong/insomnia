import path from "node:path";

import { faker } from "@faker-js/faker";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { TreeNodeType } from "@package/enums/tree-node-types";
import { test } from "@package/misc/fixtures";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify OpenAPI Webhooks Import Into A Webhooks Folder With The webhook_url Variable As Their URL", async ({
  user,
}) => {
  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "webhooks-with-paths.yaml"),
  );

  const tree = await workspacePage.getTree();
  const nodes = tree.flatten();
  const webhooksFolder = nodes.find(
    (node) => node.type === TreeNodeType.Folder && node.name === "Webhooks",
  );
  const created = await httpRequestFlow.get("Pet created");
  const deleted = await httpRequestFlow.get("Pet deleted");
  const list = await httpRequestFlow.get("List pets");

  expect(webhooksFolder?.children.map((node) => node.name).sort()).toEqual([
    "Pet created",
    "Pet deleted",
  ]);
  expect(created).toMatchObject({
    method: HttpMethod.Post,
    url: "{{ _.webhook_url }}",
  });
  expect(JSON.parse(created!.body!.text!)).toEqual({ name: "string" });
  expect(deleted).toMatchObject({
    method: HttpMethod.Post,
    url: "{{ _.webhook_url }}",
  });
  expect(list).toMatchObject({
    method: HttpMethod.Get,
    url: "{{ _.base_url }}/pets",
  });
});

test("Verify A Webhooks-Only OpenAPI Document Without Paths Imports Its Webhook Requests", async ({
  user,
}) => {
  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "webhooks-only.yaml"),
  );

  const nodes = await workspacePage.getNodes();
  const created = await httpRequestFlow.get("Pet created");

  expect(
    nodes.some(
      (node) => node.type === TreeNodeType.Folder && node.name === "Webhooks",
    ),
  ).toBe(true);
  expect(created).toMatchObject({
    method: HttpMethod.Post,
    url: "{{ _.webhook_url }}",
  });
  expect(JSON.parse(created!.body!.text!)).toEqual({ name: "string" });
});

test("Verify A Tag Named Webhooks Imports Alongside The Webhooks Folder As Two Same-Named Folders", async ({
  user,
}) => {
  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "webhooks-tag-collision.yaml"),
  );
  const folders = (await workspacePage.getNodes()).filter(
    (node) => node.type === TreeNodeType.Folder && node.name === "Webhooks",
  );
  const created = await httpRequestFlow.get("Pet created");

  expect(folders).toHaveLength(2);
  expect(created).toMatchObject({
    method: HttpMethod.Post,
    url: "{{ _.webhook_url }}",
  });
});
