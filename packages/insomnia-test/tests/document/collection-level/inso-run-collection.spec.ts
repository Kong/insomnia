import path from "node:path";

import { faker } from "@faker-js/faker";
import { ExportFormat } from "@package/enums/export-format";
import { ProjectType } from "@package/enums/project-types";
import { waitForExportedFile } from "@package/misc/export-file";
import { test } from "@package/misc/fixtures";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

const FIXTURE = path.join(import.meta.dirname, "collection-level-properties.yaml");
const COLLECTION_NAME = "Collection Level Properties";
const REQUEST_NAME = "Echo Request";

const EXPECTED_AUTHORIZATION = `Basic ${Buffer.from("collection-user:collection-pass").toString("base64")}`;

// Needs the inso bundle: `npm run build -w insomnia-inso`.
test("`inso run collection` applies collection-level headers, auth and scripts", async ({ user }, testInfo) => {
  const { workspaceFlow, importFlow, exportFlow, httpRequestFlow, insoFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  await importFlow.importFile(project, FIXTURE);
  const collection = await workspaceFlow.getCollection(COLLECTION_NAME);
  expect(collection).toBeTruthy();

  // What the desktop app sends for the collection's request.
  const request = await httpRequestFlow.get(REQUEST_NAME);
  const desktopResponse = await httpRequestFlow.send(request!);
  const desktopHeaders = (desktopResponse.preview as { headers: Record<string, string> }).headers;

  // Run the same collection, exported as v5, with inso.
  const exportPath = testInfo.outputPath("inso-collection.yaml");
  await exportFlow.exportCollection(collection!, ExportFormat.InsomniaV5, exportPath);
  await waitForExportedFile(exportPath);

  const result = await insoFlow.runCollection({
    workingDir: exportPath,
    includeFullData: true,
  });
  expect(result.exitCode, result.stderr || result.stdout).toBe(0);
  expect(result.statusCodes).toEqual([200]);

  // The echo endpoint returns the headers inso actually sent.
  const insoHeaders = JSON.parse(result.executions[0].response!.data!).headers as Record<string, string>;
  expect(insoHeaders).toMatchObject({
    "x-collection": "c",
    "x-from-collection-script": "yes",
    authorization: EXPECTED_AUTHORIZATION,
  });
  for (const name of ["x-collection", "x-from-collection-script", "authorization"]) {
    expect(insoHeaders[name]).toBe(desktopHeaders[name]);
  }
});
