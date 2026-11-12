import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ExportFormat } from "@package/enums/export-format";
import { waitForExportedFile } from "@package/misc/export-file";
import { randomJwkKey } from "@package/misc/field-encryption-fixtures";
import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createBasicAuthCollection } from "./helpers";

test("inso runs an export file and a git repository without a key, and without any encryption message", async ({
  user,
  dataPath,
}) => {
  const { exportFlow, insoFlow } = user.flowManager;
  const { collection, workspaceId } = await createBasicAuthCollection(user, dataPath);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "insomnia-inso-sources-"));

  try {
    // 1. An Insomnia export file
    const exportFile = path.join(dir, "export.yaml");
    await exportFlow.exportCollection(collection, ExportFormat.InsomniaV5, exportFile);
    await waitForExportedFile(exportFile);

    // 2. A Git Sync repository: what the app syncs, one YAML file per document in `.insomnia/<Type>/`, as plaintext
    const repo = path.join(dir, "git-repo");
    const docs = async (type: string, query: Record<string, unknown>) =>
      user.pageManager.findDocs(`insomnia.${type}.db`, query);
    const write = (type: string, doc: { _id: string }) => {
      const folder = path.join(repo, ".insomnia", type);
      fs.mkdirSync(folder, { recursive: true });
      // JSON is YAML, and the values here need no quoting care
      fs.writeFileSync(path.join(folder, `${doc._id}.yml`), JSON.stringify(doc, null, 2));
    };
    for (const doc of await docs("Workspace", { _id: workspaceId })) write("Workspace", doc);
    for (const doc of await docs("Environment", { parentId: workspaceId })) write("Environment", doc);
    for (const doc of await docs("Request", { parentId: workspaceId })) write("Request", doc);
    // The credentials sit in the repository as the user typed them: nothing there is encrypted
    expect(fs.readdirSync(path.join(repo, ".insomnia", "Request"))).toHaveLength(1);

    for (const [source, workingDir, id] of [
      ["export file", exportFile, undefined],
      ["git repository", repo, workspaceId],
    ] as const) {
      for (const [keyLabel, encryptionKeyEnv] of [
        ["no key", undefined],
        ["an unrelated key set in the environment", randomJwkKey()],
      ] as const) {
        const result = await insoFlow.runCollection({ workingDir, workspaceId: id, encryptionKeyEnv });
        const label = `${source}, ${keyLabel}`;
        expect(result.statusCodes, `${label}: ${result.stdout}${result.stderr}`).toEqual([200]);
        expect(result.exitCode, label).toBe(0);
        expect(result.stdout + result.stderr, `${label}: no encryption warning or error`).not.toMatch(/encrypt/i);
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
