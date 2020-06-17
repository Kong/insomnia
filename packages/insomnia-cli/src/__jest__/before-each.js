import * as db from '../db/mem-db';

export function globalBeforeEach() {
  // Setup the local database in case it's used
  db.init(true);
}
