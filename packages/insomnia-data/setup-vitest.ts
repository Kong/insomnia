import { initDatabase, initServices } from 'insomnia-data';
import { createNedbDatabase, servicesNodeImpl } from 'insomnia-data/node';
import { vi } from 'vitest';

import { v4Mock } from './__mocks__/uuid';

await initDatabase(createNedbDatabase(), { inMemoryOnly: true }, true);
await initServices(servicesNodeImpl);

vi.mock('uuid', () => ({
  v4: () => v4Mock(),
}));
