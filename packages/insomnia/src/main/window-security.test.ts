import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MAIN_WINDOW_SECURITY } from './window-security';

// These tests are a deliberate guardrail: they fail CI if the main renderer
// window's security posture is weakened (e.g. an AI/PR flips nodeIntegration on
// or contextIsolation off as a shortcut to make renderer code work). Weakening
// these re-exposes Node.js to rendered content. Do not "fix" a failure here by
// editing the expected values — move the offending logic to the main process.
describe('main window security posture', () => {
  it('pins the security-critical webPreferences values', () => {
    expect(MAIN_WINDOW_SECURITY).toEqual({
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: true,
    });
  });

  it('applies the pinned values to the main BrowserWindow without weakening overrides', () => {
    const source = readFileSync(path.join(__dirname, 'window-utils.ts'), 'utf8');

    // Isolate the main window construction (the hidden window legitimately uses
    // nodeIntegration:true / contextIsolation:false, so we must not scan it).
    const start = source.indexOf('const mainBrowserWindow = new BrowserWindow(');
    const end = source.indexOf("browserWindows.set('Insomnia'", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const mainWindowBlock = source.slice(start, end);

    // The block must derive its security flags from the pinned constant...
    expect(mainWindowBlock).toContain('...MAIN_WINDOW_SECURITY');
    // ...and must not re-introduce a weakening override.
    expect(mainWindowBlock).not.toMatch(/nodeIntegration\s*:\s*true/);
    expect(mainWindowBlock).not.toMatch(/contextIsolation\s*:\s*false/);
  });
});
