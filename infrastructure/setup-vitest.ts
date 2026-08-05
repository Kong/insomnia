import { initDatabase, initServices } from 'insomnia-data';
import { createNedbDatabase, servicesNodeImpl } from 'insomnia-data/node';

await initDatabase(createNedbDatabase(), { inMemoryOnly: true }, true);
await initServices(servicesNodeImpl);
