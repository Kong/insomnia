import path from 'node:path';

import { faker } from '@faker-js/faker';
import { HttpMethod } from '@package/enums/http-method';
import { ProjectType } from '@package/enums/project-types';
import { test } from '@package/misc/fixtures';
import { Project } from '@package/models/project';
import { expect } from '@playwright/test';

test('Verify OpenAPI 3.2 XML Object nodeType Values And Deprecated attribute And wrapped Keywords Import Without Changing The Requests', async ({
  user,
}) => {
  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));

  await importFlow.importFile(project, path.join(import.meta.dirname, 'node-types.yaml'));

  const item = await httpRequestFlow.get('Create an item');
  const legacyItem = await httpRequestFlow.get('Create a legacy item');

  expect(item?.method).toBe(HttpMethod.Post);
  expect(legacyItem?.method).toBe(HttpMethod.Post);
  expect(Object.keys(JSON.parse(item!.body!.text!)).sort()).toEqual(['id', 'meta', 'note', 'raw', 'tags', 'title']);
  expect(Object.keys(JSON.parse(legacyItem!.body!.text!)).sort()).toEqual(['id', 'tags']);
});

test('Verify An OpenAPI 3.2 application/xml Request Body Is Generated Using The XML Object name, prefix, namespace And nodeType', async ({
  user,
}) => {
  test.fail(true, "INS-4304");

  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));

  await importFlow.importFile(project, path.join(import.meta.dirname, 'xml-request-body.yaml'));

  const order = await httpRequestFlow.get('Create an order');

  expect(order?.body?.mimeType).toBe('application/xml');
  expect(order?.body?.text).toContain('<ord:order');
  expect(order?.body?.text).toContain('xmlns:ord="https://example.com/schemas/order"');
  expect(order?.body?.text).toContain('orderId=');
  expect(order?.body?.text).toContain('<product>');
});
