import { vi } from 'vitest';

import { nodeLibcurlMock } from './src/__mocks__/@getinsomnia/node-libcurl';
import { electronMock } from './src/__mocks__/electron';
import { database as db } from './src/common/database';
import * as models from './src/models';
import { v4Mock } from './src/models/__mocks__/uuid';
await db.init(models.types(), { inMemoryOnly: true }, true, () => { },);
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
