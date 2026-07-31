import { expect, it } from 'vitest';

import { formatInventory, hostOnlyInventory, pluginFacingInventory } from '../templating-worker-database-inventory';

// Not a regression check — prints the handler scoping inventory as a table for eyeballing.
// The authoritative gates live in templating-worker-database-inventory.test.ts.
it('prints the bridge-handler scoping inventory', () => {
  const lines = formatInventory();
  console.log(`${'path'.padEnd(38)} ${'side-effect'.padEnd(22)} ${'capability'.padEnd(14)} guards`);
  console.log(lines.join('\n'));
  console.log(
    `\n${pluginFacingInventory().length} plugin-facing (capability-gated), ${hostOnlyInventory().length} host-only (directly dispatchable)`,
  );
  expect(lines.length).toBeGreaterThan(0);
});
