// Database module entry point with IoC support
// Provides a global database instance that can be injected with different implementations.
import type NeDB from '@seald-io/nedb';

import type { IDatabase } from './types';

// Export types and implementations
export * from './types';

// Global database instance
/**
 * Initialize the global database instance with a specific implementation.
 * This should be called once at application startup.
 *
 * @param impl - The database implementation to use (NeDBDatabase or BridgeDatabase)
 */
export async function initDatabase(impl: IDatabase, config?: NeDB.DataStoreOptions, forceReset?: boolean) {
  database = impl;
  await database.init(config, forceReset);
}

/**
 * Global database instance proxy for backward compatibility.
 * This is a getter that returns the initialized database instance.
 *
 * Usage:
 * - Import: `import { database } from 'insomnia-data';`
 * - Call methods directly: `await database.find(type, query);`
 */
export let database: IDatabase = new Proxy({} as IDatabase, {
  get(_target) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  },
});
