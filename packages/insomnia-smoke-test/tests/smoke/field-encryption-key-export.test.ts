import { createDecipheriv, createSecretKey } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { expect } from '@playwright/test';

import { copyFixtureDatabase } from '../../playwright/paths';
import { test as baseTest } from '../../playwright/test';
import { cleanupExportDir, createTempExportDir, mockSaveDialogForFile } from '../../playwright/utils';

const bearerToken = 'plaintext-bearer-token-before-the-key-is-exported';
const prefix = 'enc:insomnia:v1:';

// Written here on purpose and not imported from the app: this is all that a tool outside Insomnia has to know to read
// a value of the database once it has the key: prefix + base64(iv(12) || tag(16) || ciphertext), AES-256-GCM.
const decrypt = (keyBytes: Buffer, value: string) => {
  expect.soft(value.startsWith(prefix)).toBe(true);
  const payload = Buffer.from(value.slice(prefix.length), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', createSecretKey(keyBytes), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8');
};

const keyFromJwk = (jwkText: string) => {
  const jwk = JSON.parse(jwkText);
  expect.soft(jwk.kty).toBe('oct');
  return Buffer.from(jwk.k, 'base64url');
};

const readEncryptedToken = (dataPath: string) => {
  const lines = fs
    .readFileSync(path.join(dataPath, 'insomnia.Request.db'), 'utf8')
    .split('\n')
    .filter(line => line !== '')
    .map(line => JSON.parse(line));
  return lines.find(doc => doc._id === 'req_secret_for_key_export').authentication.token as string;
};

// A plaintext database with one secret in it: the first launch encrypts it, so the key the app holds then is the one
// that opens the value on disk.
const test = baseTest.extend({
  dataPath: async ({ dataPath }, use) => {
    await copyFixtureDatabase('insomnia-legacy-db', dataPath);
    fs.appendFileSync(
      path.join(dataPath, 'insomnia.Request.db'),
      `${JSON.stringify({ _id: 'req_secret_for_key_export', type: 'Request', parentId: 'wrk_1b49626a0a9442b7b9474a1f3493bb5d', name: 'Has a secret', url: 'https://example.com', authentication: { type: 'bearer', token: bearerToken } })}\n`,
    );
    await use(dataPath);
  },
});

test.describe('Local Encryption Key in Preferences', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByTestId('settings-button').click();
    await page.locator('text=Insomnia Preferences').first().click();
  });

  test('Copy Key puts a key on the clipboard that decrypts the database', async ({ page, app, dataPath }) => {
    const encryptedToken = readEncryptedToken(dataPath);
    expect.soft(encryptedToken).not.toContain(bearerToken);

    await page.getByTestId('local-encryption-key-copy').click();
    await expect.soft(page.getByTestId('local-encryption-key-copy')).toContainText('Copied');

    const clipboardText = await app.evaluate(({ clipboard }) => clipboard.readText());
    // One token, pasteable into a shell as it is
    expect.soft(clipboardText).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    const keyBytes = keyFromJwk(Buffer.from(clipboardText, 'base64').toString('utf8'));
    expect.soft(keyBytes).toHaveLength(32);
    expect.soft(decrypt(keyBytes, encryptedToken)).toBe(bearerToken);
  });

  test('Export Key saves a JWK file that decrypts the database', async ({ page, app, dataPath }) => {
    const tempDir = createTempExportDir();
    try {
      const exportPath = path.join(tempDir, 'insomnia-encryption-key.json');
      await mockSaveDialogForFile(app, exportPath);

      await page.getByTestId('local-encryption-key-export').click();
      await expect.poll(() => fs.existsSync(exportPath)).toBe(true);

      const keyBytes = keyFromJwk(fs.readFileSync(exportPath, 'utf8'));
      expect.soft(keyBytes).toHaveLength(32);
      expect.soft(decrypt(keyBytes, readEncryptedToken(dataPath))).toBe(bearerToken);
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  test('the two buttons give the same key', async ({ page, app }) => {
    const tempDir = createTempExportDir();
    try {
      const exportPath = path.join(tempDir, 'insomnia-encryption-key.json');
      await mockSaveDialogForFile(app, exportPath);

      await page.getByTestId('local-encryption-key-copy').click();
      await page.getByTestId('local-encryption-key-export').click();
      await expect.poll(() => fs.existsSync(exportPath)).toBe(true);

      const copied = await app.evaluate(({ clipboard }) => clipboard.readText());
      expect.soft(Buffer.from(copied, 'base64').toString('utf8')).toBe(fs.readFileSync(exportPath, 'utf8'));
    } finally {
      cleanupExportDir(tempDir);
    }
  });
});
