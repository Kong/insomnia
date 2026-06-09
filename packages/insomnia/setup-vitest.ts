import { initDatabase, initServices } from 'insomnia-data';
import { servicesNodeImpl } from 'insomnia-data/node';
import { vi } from 'vitest';

// eslint-disable-next-line no-restricted-imports
import { v4Mock } from '../insomnia-data/__mocks__/uuid';
import { nodeLibcurlMock } from './src/__mocks__/@getinsomnia/node-libcurl';
import { electronMock } from './src/__mocks__/electron';
import { initRuntime } from './src/common/runtime';
import { nodeRuntime } from './src/common/runtime/runtime.node';
import { mainDatabase } from './src/main/database.main';

await initDatabase(mainDatabase, { inMemoryOnly: true }, true);
await initServices(servicesNodeImpl);
initRuntime(nodeRuntime);

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
