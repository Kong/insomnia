import fs from "node:fs";
import path from "node:path";

import { faker } from "@faker-js/faker";
import { ExportFormat } from "@package/enums/export-format";
import { ProjectType } from "@package/enums/project-types";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { waitForExportedFile } from "@package/misc/export-file";
import { test } from "@package/misc/fixtures";
import { Project } from "@package/models/project";
import type { ResponseView } from "@package/models/response";
import { expect } from "@playwright/test";

const FIXTURE = path.join(import.meta.dirname, "collection-level-properties.yaml");
const COLLECTION_NAME = "Collection Level Properties";
const REQUEST_NAME = "Echo Request";

const EXPECTED_AUTHORIZATION = `Basic ${Buffer.from("collection-user:collection-pass").toString("base64")}`;

async function expectCollectionLevelValues(response: ResponseView) {
  expect(response.statusBar.text).toBe("200 OK");
  expect(response.preview).toMatchObject({
    headers: expect.objectContaining({
      "x-collection": "c",
      "x-from-collection-script": "yes",
      authorization: EXPECTED_AUTHORIZATION,
    }),
  });
  await expect
    .poll(() => response.console(), { timeout: DEFAULT_TIMEOUT })
    .toContain("collection after-response script");
}

test("Collection-level values survive export and re-import (v5 YAML)", async ({ user }, testInfo) => {
  const { workspaceFlow, importFlow, exportFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  // 1. Import the fixture and send a request through the echo endpoint.
  await importFlow.importFile(project, FIXTURE);
  const collection = await workspaceFlow.getCollection(COLLECTION_NAME);
  expect(collection).toBeTruthy();
  const request = await httpRequestFlow.get(REQUEST_NAME);
  expect(request).toBeTruthy();
  await expectCollectionLevelValues(await httpRequestFlow.send(request!));

  // 2. Export the collection as Insomnia v5 and check the collection properties are in the YAML.
  const exportPath = testInfo.outputPath("collection-level-export.yaml");
  await exportFlow.exportCollection(collection!, ExportFormat.InsomniaV5, exportPath);
  const exported = await waitForExportedFile(exportPath);
  expect(exported).toContain("type: collection.insomnia.rest/5.0");
  // Collection-level properties sit at the top level, after `collection:`/`environments:`.
  const topLevel = exported.slice(exported.indexOf("\nheaders:"));
  expect(topLevel).toMatch(/^headers:\n {2}- name: x-collection\n {4}value: c$/m);
  expect(topLevel).toMatch(/^authentication:\n(?: {2}.*\n)*? {2}type: basic$/m);
  expect(topLevel).toContain("username: collection-user");
  expect(exported).toContain("collection after-response script");
  expect(exported).toContain("x-from-collection-script");

  // 3. Re-import the export. The sidebar looks items up by name, so give the copy its own
  //    collection and request names; everything else is left as exported.
  const reimportName = `${COLLECTION_NAME} Reimport`;
  const reimportRequestName = `${REQUEST_NAME} Reimport`;
  const reimportPath = testInfo.outputPath("collection-level-reimport.yaml");
  fs.writeFileSync(
    reimportPath,
    exported
      .replace(/^name: Collection Level Properties$/m, `name: ${reimportName}`)
      .replace(`name: ${REQUEST_NAME}`, `name: ${reimportRequestName}`),
  );
  await importFlow.importFile(project, reimportPath);
  expect(await workspaceFlow.getCollection(reimportName)).toBeTruthy();

  // 4. The re-imported collection behaves the same.
  const reimported = await httpRequestFlow.get(reimportRequestName);
  expect(reimported).toBeTruthy();
  await expectCollectionLevelValues(await httpRequestFlow.send(reimported!));
});
