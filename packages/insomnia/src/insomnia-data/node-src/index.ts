import { createDirectoryProjectDatabase } from './database/database-directory-projects';
import { createNedbDatabase as createBaseNedbDatabase, flushChangesImpl } from './database/database-nedb';

export const createNedbDatabase: typeof createBaseNedbDatabase = wrapper => {
  return createBaseNedbDatabase(nedbDatabase => {
    const directoryProjectDatabase = createDirectoryProjectDatabase(nedbDatabase);
    return wrapper ? wrapper(directoryProjectDatabase as any) : (directoryProjectDatabase as any);
  });
};

export { flushChangesImpl };

export { servicesNodeImpl } from './services';
