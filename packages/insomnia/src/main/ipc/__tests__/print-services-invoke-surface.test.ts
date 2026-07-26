import { expect, it } from 'vitest';

import { describeServicesInvokeSurface, findPairsMissingNamedHandler, formatServicesInvokeSurfaceEntries } from '../services-invoke-surface';

// Not a regression check — prints the full services.invoke surface for eyeballing. Run via
// `npm run sandbox:services-invoke`.
it('prints the services.invoke surface', () => {
  const entries = describeServicesInvokeSurface();
  const lines = formatServicesInvokeSurfaceEntries(entries);
  console.log(lines.join('\n'));
  const remaining = findPairsMissingNamedHandler();
  console.log(`\n${entries.length} pairs, ${remaining.length} still on the generic gateway, ${entries.length - remaining.length} migrated`);
  expect(lines.length).toBeGreaterThan(0);
});
