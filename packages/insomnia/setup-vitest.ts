import { vi } from 'vitest';

import { electron } from './src/__mocks__/electron';
import { database as db } from './src/common/database';
import * as models from './src/models';
import { v4 as v4Mock } from './src/models/__mocks__/uuid';
await db.init(
  models.types(),
  {
    inMemoryOnly: true,
  },
  true,
  () => { },
);
vi.mock('electron', () => ({ default: electron }));

vi.mock('uuid', () => ({
  v4: () => v4Mock(),
}));
