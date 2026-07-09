import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ default: { app: { getPath: () => '/home/user/Insomnia' } } }));
vi.mock('insomnia-data', () => ({ services: { settings: { getOrCreate: vi.fn() } } }));

import { isPathAllowed } from '../secure-read-file';

describe('isPathAllowed enforces a separator boundary on allowed roots', () => {
  const root = '/opt/allowed-root';

  it('allows the allowed root itself and files inside it', () => {
    expect(isPathAllowed(root, [root]).isAllowed).toBe(true);
    expect(isPathAllowed(`${root}/sub/file.txt`, [root]).isAllowed).toBe(true);
  });

  it('rejects a sibling directory that merely shares a name prefix', () => {
    expect(isPathAllowed(`${root}-other/secret`, [root]).isAllowed).toBe(false);
  });

  it('rejects a sibling install sharing a name prefix (e.g. Insomnia Nightly vs Insomnia)', () => {
    const insomnia = '/apps/Insomnia';
    expect(isPathAllowed('/apps/Insomnia Nightly/insomnia.OAuth2Token.db', [insomnia]).isAllowed).toBe(false);
    expect(isPathAllowed('/apps/Insomnia/insomnia.Request.db', [insomnia]).isAllowed).toBe(true);
  });
});

describe('isPathAllowed resolves symlinks before checking the allow list', () => {
  const realTmpdir = os.tmpdir();
  let allowedDir: string;
  let outsideDir: string;

  beforeEach(() => {
    allowedDir = fs.mkdtempSync(path.join(realTmpdir, 'insomnia-allowed-'));
    outsideDir = fs.mkdtempSync(path.join(realTmpdir, 'insomnia-outside-'));
    // tmpdir and userData are always allowed roots (for buildMultipart / the db); pin both away from
    // realTmpdir so the "outside" fixture dir below isn't allowed by those carve-outs instead of by
    // the symlink check under test.
    vi.spyOn(os, 'tmpdir').mockReturnValue('/insomnia-test-mock-tmpdir');
    vi.stubEnv('INSOMNIA_DATA_PATH', '/insomnia-test-mock-userdata');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    fs.rmSync(allowedDir, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  });

  it('rejects a symlink inside the allowed dir whose real target is outside it', () => {
    const target = path.join(outsideDir, 'secret.txt');
    fs.writeFileSync(target, 'secret');
    const link = path.join(allowedDir, 'link.txt');
    fs.symlinkSync(target, link);
    expect(isPathAllowed(link, [allowedDir]).isAllowed).toBe(false);
  });

  it('allows a real file inside the allowed dir', () => {
    const real = path.join(allowedDir, 'file.txt');
    fs.writeFileSync(real, 'ok');
    expect(isPathAllowed(real, [allowedDir]).isAllowed).toBe(true);
  });
});
