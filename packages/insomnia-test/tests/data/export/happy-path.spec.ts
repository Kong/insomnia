import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";

import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ExportFormat } from "../../../enums/export-format";
import { HttpMethod } from "../../../enums/http-method";
import { ProjectType } from "../../../enums/project-types";
import { waitForExportedFile } from "../../../misc/export-file";
import { test } from "../../../misc/fixtures";
import { Collection } from "../../../models/collection";
import { HttpRequest } from "../../../models/http-request";
import { Project } from "../../../models/project";

test("Verify exporting a Collection via its context menu (HAR and Insomnia v5) and a Project via Preferences -> Data each write the expected files", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, exportFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const request = await httpRequestFlow.create(
    collection,
    new HttpRequest({
      name: faker.string.alphanumeric(10),
      method: HttpMethod.Get,
      url: "https://example.com",
    }),
  );

  const collectionHar = path.join(
    os.tmpdir(),
    `${faker.string.alphanumeric(10)}.har`,
  );
  await exportFlow.exportCollection(collection, ExportFormat.Har, collectionHar);

  const projectDir = path.join(os.tmpdir(), faker.string.alphanumeric(10));
  fs.mkdirSync(projectDir, { recursive: true });
  await exportFlow.exportProject(project, ExportFormat.InsomniaV5, projectDir);

  const collectionYaml = path.join(
    os.tmpdir(),
    `${faker.string.alphanumeric(10)}.yaml`,
  );
  await exportFlow.exportCollection(collection, ExportFormat.InsomniaV5, collectionYaml);

  const harContent = await waitForExportedFile(collectionHar);
  const collectionContent = await waitForExportedFile(collectionYaml);
  const projectDirFiles = fs.readdirSync(projectDir);

  expect(harContent).toContain('"log"');
  expect(harContent).toContain(request.url);
  expect(collectionContent).toContain(`name: ${collection.name}`);
  expect(collectionContent).toContain(request.url);
  expect(projectDirFiles.length).toBeGreaterThan(0);
});
