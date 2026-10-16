import * as os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';

import { ApiSpecExportFormat } from '../../../enums/api-spec-export-format';
import { ProjectType } from '../../../enums/project-types';
import { waitForExportedFile } from '../../../misc/export-file';
import { expect, test } from '../../../misc/fixtures';
import { Collection } from '../../../models/collection';
import { Project } from '../../../models/project';

const petStoreSpec = (title: string) =>
  `openapi: 3.0.4
info:
  title: ${title}
  version: 1.0.0
paths:
  /pets:
    get:
      responses:
        '200':
          description: OK
`;

test("Verify exporting an API Collection's OpenAPI spec as YAML and JSON from the sidebar dropdown", async ({
  user,
}) => {
  const { workspaceFlow, exportFlow } = user.flowManager;

  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const title = faker.commerce.productName();
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10), petStoreSpec(title)),
  );

  const yamlPath = path.join(os.tmpdir(), `${faker.string.alphanumeric(10)}.yaml`);
  await exportFlow.exportOpenApiSpec(collection, ApiSpecExportFormat.Yaml, yamlPath);
  const yamlContent = await waitForExportedFile(yamlPath);
  const jsonPath = path.join(os.tmpdir(), `${faker.string.alphanumeric(10)}.json`);
  await exportFlow.exportOpenApiSpec(collection, ApiSpecExportFormat.Json, jsonPath);
  const jsonContent = await waitForExportedFile(jsonPath);
  const json = JSON.parse(jsonContent);

  expect(yamlContent).toContain('openapi: 3.0.4');
  expect(yamlContent).toContain(title);
  expect(json).toMatchObject({ openapi: '3.0.4' });
  expect(json.info.title).toBe(title);
});

test("Verify exporting shows 'Cannot export' while the spec is empty, then succeeds once the spec is filled in", async ({
  user,
}) => {
  const { workspaceFlow, exportFlow } = user.flowManager;

  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)));

  const emptyPath = path.join(os.tmpdir(), `${faker.string.alphanumeric(10)}.yaml`);
  await expect(exportFlow.exportOpenApiSpec(collection, ApiSpecExportFormat.Yaml, emptyPath)).rejects.toThrow(
    'does not contain an OpenAPI specification to export',
  );
  await workspaceFlow.closeDialog();

  const title = faker.commerce.productName();
  await workspaceFlow.fillSpecification(collection, petStoreSpec(title));

  const yamlPath = path.join(os.tmpdir(), `${faker.string.alphanumeric(10)}.yaml`);
  await exportFlow.exportOpenApiSpec(collection, ApiSpecExportFormat.Yaml, yamlPath);
  const yamlContent = await waitForExportedFile(yamlPath);

  expect(yamlContent).toContain('openapi: 3.0.4');
  expect(yamlContent).toContain(title);
});
