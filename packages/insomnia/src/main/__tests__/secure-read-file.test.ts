import fs from 'node:fs';
import path from 'node:path';

import { services } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// secureReadFile backs the templating/plugin/script file-read capability (the `file` tag,
// `context.util.readFile`, and the sandbox bridge). NeDB stores every model as
// `insomnia.<Model>.db` directly inside the userData directory that this function otherwise
// allows, so it must never let a template read those files, even via a symlink or a
// sibling-directory path that merely shares the userData directory's name as a prefix.
//
// This exercises the real `services.settings` (an in-memory NeDB store set up by
// setup-vitest.ts) rather than mocking `insomnia-data`, since secure-read-file.ts's `services`
// binding is already resolved against the real module graph by the time this test file loads.
//
// Test fixtures live under a scratch directory in this package rather than os.tmpdir(), since
// os.tmpdir() is itself an unconditionally allowed root (used for multipart bodies) and would
// make every "outside the allowlist" scenario trivially pass regardless of this fix.

const TEST_ROOT = path.join(__dirname, '.tmp-secure-read-file');

describe('secureReadFile', () => {
  // vitest.config.ts sets INSOMNIA_DATA_PATH=os.tmpdir() globally, which takes precedence over
  // the electron `userData` path in getSecuredFolderAllowList — override it per test so the
  // "allowed" root is a directory this suite controls.
  const originalInsomniaDataPath = process.env.INSOMNIA_DATA_PATH;
  let userDataDir: string;

  beforeEach(async () => {
    fs.mkdirSync(TEST_ROOT, { recursive: true });
    userDataDir = fs.mkdtempSync(path.join(TEST_ROOT, 'userData-'));
    process.env.INSOMNIA_DATA_PATH = userDataDir;
    await services.settings.patch({ dataFolders: [] });
  });

  afterEach(() => {
    process.env.INSOMNIA_DATA_PATH = originalInsomniaDataPath;
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it('rejects a NeDB database file inside the allowed userData directory', async () => {
    const { secureReadFile } = await import('../secure-read-file');
    const dbFile = path.join(userDataDir, 'insomnia.Environment.db');
    fs.writeFileSync(dbFile, '{"secret":"vault-value"}');

    await expect(secureReadFile(dbFile)).rejects.toThrow(/cannot access/);
  });

  it('allows an ordinary file inside the allowed userData directory', async () => {
    const { secureReadFile } = await import('../secure-read-file');
    const file = path.join(userDataDir, 'notes.txt');
    fs.writeFileSync(file, 'hello');

    await expect(secureReadFile(file)).resolves.toBe('hello');
  });

  it('rejects a sibling directory that merely shares the allowed directory as a string prefix', async () => {
    const { secureReadFile } = await import('../secure-read-file');
    const siblingDir = `${userDataDir}Other`;
    fs.mkdirSync(siblingDir);
    const file = path.join(siblingDir, 'notes.txt');
    fs.writeFileSync(file, 'hello');

    await expect(secureReadFile(file)).rejects.toThrow(/cannot access/);
  });

  it('rejects a symlink inside the allowed directory that resolves to a NeDB database file', async () => {
    const { secureReadFile } = await import('../secure-read-file');
    const dbFile = path.join(userDataDir, 'insomnia.Settings.db');
    fs.writeFileSync(dbFile, '{"secret":"settings-value"}');
    const innocuousLink = path.join(userDataDir, 'innocuous.txt');
    fs.symlinkSync(dbFile, innocuousLink);

    await expect(secureReadFile(innocuousLink)).rejects.toThrow(/cannot access/);
  });

  it('rejects a symlink inside the allowed directory that resolves outside every allowed root', async () => {
    const { secureReadFile } = await import('../secure-read-file');
    const outsideDir = fs.mkdtempSync(path.join(TEST_ROOT, 'outside-'));
    const outsideFile = path.join(outsideDir, 'secret.txt');
    fs.writeFileSync(outsideFile, 'outside-secret');
    const link = path.join(userDataDir, 'link.txt');
    fs.symlinkSync(outsideFile, link);

    await expect(secureReadFile(link)).rejects.toThrow(/cannot access/);
  });

  it('allows a file inside a user-configured allowlisted folder', async () => {
    const customDir = fs.mkdtempSync(path.join(TEST_ROOT, 'custom-'));
    await services.settings.patch({ dataFolders: [customDir] });
    const { secureReadFile } = await import('../secure-read-file');
    const file = path.join(customDir, 'data.txt');
    fs.writeFileSync(file, 'custom-data');

    await expect(secureReadFile(file)).resolves.toBe('custom-data');
  });

  it('rejects a NeDB database file inside a user-configured allowlisted folder', async () => {
    const customDir = fs.mkdtempSync(path.join(TEST_ROOT, 'custom-'));
    await services.settings.patch({ dataFolders: [customDir] });
    const { secureReadFile } = await import('../secure-read-file');
    const dbFile = path.join(customDir, 'insomnia.Request.db');
    fs.writeFileSync(dbFile, '{"secret":"request-value"}');

    await expect(secureReadFile(dbFile)).rejects.toThrow(/cannot access/);
  });
});
