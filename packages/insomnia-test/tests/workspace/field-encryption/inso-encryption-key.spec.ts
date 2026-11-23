import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readRawDocs } from "@package/misc/db";
import { waitForExportedFile } from "@package/misc/export-file";
import {
  copyDataDir,
  randomJwkKey,
  snapshotDataDir,
} from "@package/misc/field-encryption-fixtures";
import { test } from "@package/misc/fixtures";
import { createBasicAuthCollection } from "@package/tests/workspace/field-encryption/helpers";
import { expect } from "@playwright/test";

async function takeKeys(user: Parameters<typeof createBasicAuthCollection>[0]) {
  const { preferencesFlow } = user.flowManager;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "insomnia-inso-key-"));
  const file = path.join(dir, "insomnia-encryption-key.json");
  await preferencesFlow.openKeyPanel();
  await preferencesFlow.copyKey("continue");
  const base64 = await preferencesFlow.readClipboard();
  await preferencesFlow.exportKey("continue", file);
  const jwk = await waitForExportedFile(file);
  await preferencesFlow.closeKeyPanel();
  fs.rmSync(dir, { recursive: true, force: true });
  return { base64, jwk };
}

test("inso decrypts the app's data with the key: option, environment variable, both key formats", async ({
  user,
  dataPath,
}) => {
  const { insoFlow } = user.flowManager;
  const { workspaceId } = await createBasicAuthCollection(user, dataPath);
  const [environment] = await user.pageManager.findDocs("insomnia.Environment.db", { parentId: workspaceId });
  const { base64, jwk } = await takeKeys(user);
  expect(base64).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  expect(JSON.parse(jwk)).toMatchObject({ kty: "oct" });

  const copies: string[] = [];
  const run = async (options: {
    encryptionKeyOption?: string;
    encryptionKeyEnv?: string;
    printOptions?: boolean;
    ci?: boolean;
  }) => {
    const workingDir = copyDataDir(dataPath);
    copies.push(workingDir);
    return insoFlow.runCollection({ workingDir, workspaceId, environmentId: environment._id, ...options });
  };

  try {
    const attempts: [string, { encryptionKeyOption?: string; encryptionKeyEnv?: string }][] = [
      ["--encryption-key with the copied (base64) key", { encryptionKeyOption: base64 }],
      ["--encryption-key with the exported (JWK) key", { encryptionKeyOption: jwk }],
      ["INSOMNIA_ENCRYPTION_KEY with the copied (base64) key", { encryptionKeyEnv: base64 }],
      ["INSOMNIA_ENCRYPTION_KEY with the exported (JWK) key", { encryptionKeyEnv: jwk }],
    ];
    for (const [label, options] of attempts) {
      const result = await run(options);
      expect(result.statusCodes, `${label}: ${result.stdout}${result.stderr}`).toEqual([200]);
      expect(result.exitCode, label).toBe(0);
      expect(result.stdout + result.stderr, `${label}: no decryption problem is reported`).not.toMatch(
        /could not decrypt|no encryption key/i,
      );
    }

    for (const options of [{ encryptionKeyOption: base64 }, { encryptionKeyEnv: base64 }]) {
      const printed = await run({ ...options, printOptions: true, ci: false });
      expect(printed.stdout + printed.stderr).toContain("encryptionKey: '***'");
      expect(printed.stdout + printed.stderr).not.toContain(base64);
    }
    const printedJwk = await run({ encryptionKeyOption: jwk, printOptions: true, ci: false });
    expect(printedJwk.stdout + printedJwk.stderr).toContain("encryptionKey: '***'");
    expect(printedJwk.stdout + printedJwk.stderr).not.toContain(JSON.parse(jwk).k);
  } finally {
    for (const copy of copies) fs.rmSync(copy, { recursive: true, force: true });
  }
});

test("inso reports a missing, wrong or malformed key clearly, and changes no data", async ({ user, dataPath }) => {
  const { insoFlow } = user.flowManager;
  const { request, workspaceId } = await createBasicAuthCollection(user, dataPath);
  const original = copyDataDir(dataPath);
  const copies = [original];
  const ciphertext = readRawDocs(dataPath, "Request").find((doc) => doc.name === request.name).authentication.password;

  const run = async (options: { encryptionKeyOption?: string; encryptionKeyEnv?: string }) => {
    const workingDir = copyDataDir(original);
    copies.push(workingDir);
    const before = snapshotDataDir(workingDir);
    const result = await insoFlow.runCollection({ workingDir, workspaceId, ...options });
    return { ...result, output: result.stdout + result.stderr, dataUnchanged: JSON.stringify(snapshotDataDir(workingDir)) === JSON.stringify(before) };
  };

  try {
    const missing = await run({});
    expect(missing.output).toMatch(/encrypted value\(s\).*no encryption key/s);
    expect(missing.output).toContain("INSOMNIA_ENCRYPTION_KEY");
    expect(missing.output).toContain("--encryption-key");
    expect(missing.statusCodes).toEqual([401]);
    expect(missing.dataUnchanged, "no key: data untouched").toBe(true);

    const wrongKey = randomJwkKey();
    const wrong = await run({ encryptionKeyOption: wrongKey });
    expect(wrong.exitCode).not.toBe(0);
    expect(wrong.output).toMatch(/Could not decrypt \d+ encrypted value/);
    expect(wrong.output).toContain("Request authentication.password");
    expect(wrong.output).not.toContain(ciphertext);
    expect(wrong.output).not.toContain(JSON.parse(wrongKey).k);
    expect(wrong.statusCodes, "nothing is sent with undecryptable values").toEqual([]);
    expect(wrong.dataUnchanged, "wrong key: data untouched").toBe(true);

    const garbage = "this-is-not-a-key-ABC123xyz";
    for (const options of [{ encryptionKeyOption: garbage }, { encryptionKeyEnv: garbage }]) {
      const malformed = await run(options);
      expect(malformed.exitCode).not.toBe(0);
      expect(malformed.output).toMatch(/key/i);
      expect(malformed.output).not.toContain(garbage);
      expect(malformed.statusCodes).toEqual([]);
      expect(malformed.dataUnchanged, "malformed key: data untouched").toBe(true);
    }
  } finally {
    for (const copy of copies) fs.rmSync(copy, { recursive: true, force: true });
  }
});
