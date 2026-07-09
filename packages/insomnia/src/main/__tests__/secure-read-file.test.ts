import { describe, expect, it, vi } from 'vitest';

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
    expect(isPathAllowed(`${root}-evil/secret`, [root]).isAllowed).toBe(false);
  });

  it('rejects a sibling install sharing a name prefix (e.g. Insomnia Nightly vs Insomnia)', () => {
    const insomnia = '/apps/Insomnia';
    expect(isPathAllowed('/apps/Insomnia Nightly/insomnia.OAuth2Token.db', [insomnia]).isAllowed).toBe(false);
    expect(isPathAllowed('/apps/Insomnia/insomnia.Request.db', [insomnia]).isAllowed).toBe(true);
  });
});
