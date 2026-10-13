import * as fs from "node:fs";
import path from "node:path";

import { expect, test } from "../../../misc/fixtures";

const LEGACY_DB_DIR = path.join(__dirname, "insomnia-legacy-db");

const testWithLegacyDatabase = test.extend({
  dataPath: async ({ dataPath }, use) => {
    await fs.promises.mkdir(dataPath, { recursive: true });
    for (const file of await fs.promises.readdir(LEGACY_DB_DIR)) {
      await fs.promises.copyFile(
        path.join(LEGACY_DB_DIR, file),
        path.join(dataPath, file),
      );
    }
    await use(dataPath);
  },
});

testWithLegacyDatabase(
  "Verify a legacy v7 NeDB project migrates and its data stays browsable",
  async ({ user }) => {
    const { workspaceFlow, httpRequestFlow } = user.flowManager;

    const project = await workspaceFlow.getProject("Insomnia");
    const collection = await workspaceFlow.getCollection("Local Collection");
    const request = await httpRequestFlow.get("Get list of rockets");
    const designDocument = await workspaceFlow.getCollectionSpec(
      "Local Design Document",
    );
    const designDocumentRequest = await httpRequestFlow.get(
      "Get echo",
      designDocument,
    );
    const designDocumentResponse = await httpRequestFlow.send(
      designDocumentRequest!,
    );

    expect(project).toBeTruthy();
    expect(collection).toBeTruthy();
    expect(request).toBeTruthy();
    expect(request?.url).toBe("https://httpbin.org/status/200");
    expect(designDocument).toBeTruthy();
    expect(designDocumentRequest).toBeTruthy();
    expect(designDocumentResponse.statusCode).toBe(200);
  },
);
