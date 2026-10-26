import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// Scans source as text; window-utils.ts can't be imported here (pulls in electron).
describe('main window navigation guard', () => {
  const source = readFileSync(path.join(__dirname, 'window-utils.ts'), 'utf8');

  it('gates both will-navigate and will-redirect through the same origin check', () => {
    const start = source.indexOf('const guardNavigation = ');
    const end = source.indexOf('setWindowOpenHandler', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = source.slice(start, end);

    expect(block).toContain('isTrustedAppOrigin(url, appUrl)');
    // Must not regress to a raw prefix check.
    expect(block).not.toMatch(/url\.startsWith\(appUrl\)/);

    expect(block).toContain("webContents.on('will-navigate', guardNavigation)");
    expect(block).toContain("webContents.on('will-redirect', guardNavigation)");
  });

  it('unconditionally denies new-window/popup requests', () => {
    expect(source).toMatch(/setWindowOpenHandler\(\(\) => \{\s*return \{ action: 'deny' \};\s*\}\)/);
  });
});
