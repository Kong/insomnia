import * as fs from "node:fs";
import path from "node:path";

import { HTTP_SERVER } from "@package/misc/constants";
import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

const LEGACY_DB_DIR = path.join(import.meta.dirname, "insomnia-legacy-db");

const testWithLegacyDatabase = test.extend({
  dataPath: async ({ dataPath }, use) => {
    await fs.promises.mkdir(dataPath, { recursive: true });
    for (const file of await fs.promises.readdir(LEGACY_DB_DIR)) {
      const source = path.join(LEGACY_DB_DIR, file);
      const target = path.join(dataPath, file);
      if (file === "insomnia.Request.db") {
        // The legacy requests point at the old dev echo server (localhost:4060);
        // the mock server serves the echo at HTTP_SERVER instead.
        const requests = await fs.promises.readFile(source, "utf8");
        await fs.promises.writeFile(
          target,
          requests.replaceAll("http://localhost:4060", HTTP_SERVER),
        );
        continue;
      }
      await fs.promises.copyFile(source, target);
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
    expect(designDocumentResponse.statusBar.code).toBe(200);
  },
);
