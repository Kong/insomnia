import fs from "node:fs";

import { ExportFormat } from "@package/enums/export-format";
import { waitForExportedFile } from "@package/misc/export-file";
import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createFixture } from "./support";

const DOCS = "# Collection docs\n\nShared by **every** request.";

test("Collection Docs survive export and re-import as a new collection (v5 YAML)", async ({ user }, testInfo) => {
  test.fail(true, "INS-4334");
  const { collectionFlow, exportFlow, importFlow, workspaceFlow } = user.flowManager;
  const { project, collection } = await createFixture(user.flowManager);
  await collectionFlow.setDocs(collection, DOCS);

  const exportPath = testInfo.outputPath("collection-docs-export.yaml");
  await exportFlow.exportCollection(collection, ExportFormat.InsomniaV5, exportPath);
  const exported = await waitForExportedFile(exportPath);
  expect(exported).toContain("Shared by **every** request.");

  const reimportName = `${collection.name} Reimport`;
  const reimportPath = testInfo.outputPath("collection-docs-reimport.yaml");
  fs.writeFileSync(reimportPath, exported.replace(new RegExp(`^name: ${collection.name}$`, "m"), `name: ${reimportName}`));
  await importFlow.importFile(project, reimportPath);

  const reimported = await workspaceFlow.getCollection(reimportName);
  expect(reimported).toBeTruthy();
  expect(await collectionFlow.getDocs(reimported!)).toBe(DOCS);
});
