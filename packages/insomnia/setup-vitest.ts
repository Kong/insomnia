import { vi } from 'vitest';

import { initDatabase, initServices } from '~/insomnia-data';
import { servicesNodeImpl } from '~/insomnia-data/node';

import { nodeLibcurlMock } from './src/__mocks__/@getinsomnia/node-libcurl';
import { electronMock } from './src/__mocks__/electron';
import { mainDatabase } from './src/main/database.main';
import { v4Mock } from './src/models/__mocks__/uuid';

await initDatabase(mainDatabase, { inMemoryOnly: true }, true);
await initServices(servicesNodeImpl);

vi.mock('electron', () => ({ default: electronMock }));

vi.mock('uuid', () => ({
  v4: () => v4Mock(),
}));
vi.mock('@getinsomnia/node-libcurl', () => nodeLibcurlMock);

vi.mock('isomorphic-git', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...Object.assign({}, actual),
    push: vi.fn(),
    clone: vi.fn(),
  };
});
