import { expect, it } from 'vitest';

import { formatSurfaceEntries, getSandboxEscapeProbe, getSandboxSurface } from './sandbox-surface';

// Not a regression check — prints both probes' output for eyeballing. Run via `npm run sandbox:surface`.
it('prints the sandbox capability surface', async () => {
  const entries = await getSandboxSurface();
  const lines = formatSurfaceEntries(entries);
  console.log(lines.join('\n'));
  console.log(`\n${lines.length} reachable paths`);
  expect(lines.length).toBeGreaterThan(0);
}, 20_000);

it('prints the escape probe results', async () => {
  const escape = await getSandboxEscapeProbe();
  console.log(JSON.stringify(escape, null, 2));
  expect(escape).toBeTruthy();
}, 20_000);
