import { initDatabase, initServices } from 'insomnia-data';
import { createNedbDatabase, servicesNodeImpl } from 'insomnia-data/node';
import { vi } from 'vitest';

const database = createNedbDatabase();
await initDatabase(database, { inMemoryOnly: true }, true);
await initServices(servicesNodeImpl);

// eslint-disable-next-line no-restricted-imports
import { v4Mock } from '../insomnia-data/__mocks__/uuid';

vi.mock('uuid', () => ({
  v4: () => v4Mock(),
}));
