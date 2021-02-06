// @flow
import fs from 'fs';
import { emptyDb } from '../index';
import type { Database, DbAdapter } from '../index';

const insomniaAdapter: DbAdapter = async path => {
  // Sanity check - do db files exist?

  if (!fs.existsSync(path)) return null;
  const db: Database = emptyDb();

  return db;
};

export default insomniaAdapter;
